import { and, asc, count, desc, eq, gt, gte, isNull, like, lt, lte, ne, or, sql, type ExtractTablesWithRelations } from "drizzle-orm";
import { type PgTransaction } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { auditEvents, clinicalNotes, clinicalOrders, clinicalPresets, dailyCloseouts, dispensationItems, dispensations, inventoryLots, invoiceLines, invoices, medicationOrderItems, medicationPrices, medications, patients, payments, queueEntries, serviceCharges, soapTemplates, stockMovements, triageRecords, userSessions, users, visitDiagnoses, visits, type User } from "../drizzle/schema";
import { summarizePaymentsByClinicDay } from "./reporting";
import { decryptNationalId, encryptIdentityDocument, encryptNationalId, identityDocumentLookupHash, nationalIdLookupHash } from "./nationalIdCrypto";
import { isValidThaiNationalId, maskThaiNationalId, normalizeThaiNationalId } from "../shared/nationalId";
import { isValidPassportNumber, maskPassportNumber, normalizePassportNumber, type IdentityDocumentType } from "../shared/identityDocument";

function getInsertId(result: any): number {
  if (!result) return 0;
  if (Array.isArray(result) && result.length > 0) {
    return Number(result[0]?.id ?? result[0]?.insertId ?? 0);
  }
  return Number(result.insertId ?? result.id ?? 0);
}

function getAffectedRows(result: any): number {
  if (!result) return 0;
  if (typeof result.rowCount === "number") return result.rowCount;
  if (typeof result.count === "number") return result.count;
  if (typeof result.affectedRows === "number") return result.affectedRows;
  if (Array.isArray(result) && result.length > 0 && typeof result[0]?.affectedRows === "number") {
    return result[0].affectedRows;
  }
  if (Array.isArray(result)) return result.length;
  return 1;
}

let client: ReturnType<typeof postgres> | null = null;
let database: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!database && process.env.DATABASE_URL) {
    // Supabase Transaction Pooler is required for short-lived Vercel Functions.
    // It does not support prepared statements.
    client = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
    database = drizzle(client);
  }
  return database;
}

async function requiredDb() {
  const db = await getDb();
  if (!db) throw new Error("DATABASE_UNAVAILABLE");
  return db;
}

export async function countUsers() {
  const db = await requiredDb();
  const result = await db.select({ value: count() }).from(users);
  return Number(result[0]?.value ?? 0);
}

export async function countSystemAdmins() {
  const db = await requiredDb();
  const result = await db.select({ value: count() }).from(users).where(eq(users.role, "SYSTEM_ADMIN"));
  return Number(result[0]?.value ?? 0);
}

export async function findUserByUsername(username: string) {
  const db = await requiredDb();
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result[0] ?? null;
}

export async function createInitialAdmin(input: { username: string; passwordHash: string; displayName: string }) {
  const db = await requiredDb();
  await db.transaction(async tx => {
    const existing = await tx.select({ value: count() }).from(users).where(eq(users.role, "SYSTEM_ADMIN"));
    if (Number(existing[0]?.value ?? 0) > 0) throw new Error("BOOTSTRAP_CLOSED");
    await tx.insert(users).values({
      username: input.username,
      passwordHash: input.passwordHash,
      displayName: input.displayName,
      role: "SYSTEM_ADMIN",
      mustChangePassword: false,
    });
  });
  const user = await findUserByUsername(input.username);
  if (!user) throw new Error("BOOTSTRAP_FAILED");
  return user;
}

export async function recordLoginSuccess(userId: number, audit?: AuditContext) {
  const db = await requiredDb();
  await db.transaction(async tx => {
    await tx.update(users).set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, userId));
    if (audit) {
      await tx.insert(auditEvents).values({
        action: "AUTH_LOGIN_SUCCEEDED",
        actorUserId: audit.actorUserId,
        actorRole: audit.actorRole,
        entityType: "USER",
        entityId: String(userId),
        outcome: "ALLOWED",
        requestId: audit.requestId,
        metadata: safeAuditMetadata({ method: "LOCAL_PASSWORD" }),
      });
    }
  });
}

export async function recordLoginFailure(user: User, audit?: AuditContext) {
  const db = await requiredDb();
  const now = new Date();
  const alreadyLocked = user.lockedUntil && user.lockedUntil > now;
  const previousFailures = alreadyLocked || (user.lockedUntil && user.lockedUntil <= now) ? 0 : user.failedLoginCount;
  const failedLoginCount = previousFailures + 1;
  const lockedUntil = failedLoginCount >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null;
  await db.transaction(async tx => {
    await tx.update(users).set({ failedLoginCount, lockedUntil }).where(eq(users.id, user.id));
    if (audit) {
      await tx.insert(auditEvents).values({
        action: "AUTH_LOGIN_FAILED",
        actorUserId: audit.actorUserId,
        actorRole: audit.actorRole,
        entityType: "USER",
        entityId: String(user.id),
        outcome: "DENIED",
        requestId: audit.requestId,
        metadata: safeAuditMetadata({ reason: "INVALID_CREDENTIALS", accountLocked: Boolean(lockedUntil) }),
      });
    }
  });
}

export async function createSession(userId: number, tokenHash: string, expiresAt: Date) {
  const db = await requiredDb();
  await db.insert(userSessions).values({ userId, tokenHash, expiresAt });
}

export async function findActiveSessionUser(tokenHash: string) {
  const db = await requiredDb();
  const now = new Date();
  const result = await db
    .select({ user: users })
    .from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(and(eq(userSessions.tokenHash, tokenHash), isNull(userSessions.revokedAt), gt(userSessions.expiresAt, now), eq(users.isActive, true)))
    .limit(1);
  if (!result[0]?.user) return null;
  await db.update(userSessions).set({ lastSeenAt: now }).where(eq(userSessions.tokenHash, tokenHash));
  return result[0].user;
}

export async function revokeSession(tokenHash: string) {
  const db = await requiredDb();
  await db.update(userSessions).set({ revokedAt: new Date() }).where(and(eq(userSessions.tokenHash, tokenHash), isNull(userSessions.revokedAt)));
}

/** Re-hash a staff password and invalidate every other active device session. */
export async function changeOwnPassword(input: { userId: number; passwordHash: string; currentSessionTokenHash?: string; audit: AuditContext }) {
  const db = await requiredDb();
  const now = new Date();
  await db.transaction(async tx => {
    await tx.update(users).set({ passwordHash: input.passwordHash, mustChangePassword: false, failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, input.userId));
    const activeSessions = and(eq(userSessions.userId, input.userId), isNull(userSessions.revokedAt));
    const otherSessions = input.currentSessionTokenHash ? and(activeSessions, ne(userSessions.tokenHash, input.currentSessionTokenHash)) : activeSessions;
    await tx.update(userSessions).set({ revokedAt: now }).where(otherSessions);
    await tx.insert(auditEvents).values({
      action: "AUTH_PASSWORD_CHANGED",
      actorUserId: input.audit.actorUserId,
      actorRole: input.audit.actorRole,
      entityType: "USER",
      entityId: String(input.userId),
      outcome: "ALLOWED",
      requestId: input.audit.requestId,
      metadata: safeAuditMetadata({ otherSessionsRevoked: true }),
    });
  });
}

export async function recordPasswordChangeDenied(audit: AuditContext) {
  const db = await requiredDb();
  await db.insert(auditEvents).values({
    action: "AUTH_PASSWORD_CHANGE_DENIED",
    actorUserId: audit.actorUserId,
    actorRole: audit.actorRole,
    entityType: "USER",
    entityId: String(audit.actorUserId),
    outcome: "DENIED",
    requestId: audit.requestId,
    metadata: safeAuditMetadata({ reason: "CURRENT_PASSWORD_MISMATCH" }),
  });
}

export async function recordLogout(audit: AuditContext) {
  const db = await requiredDb();
  await db.insert(auditEvents).values({
    action: "AUTH_LOGOUT",
    actorUserId: audit.actorUserId,
    actorRole: audit.actorRole,
    entityType: "USER",
    entityId: String(audit.actorUserId),
    outcome: "ALLOWED",
    requestId: audit.requestId,
    metadata: safeAuditMetadata({ method: "LOCAL_SESSION" }),
  });
}

export type StaffRole = "SYSTEM_ADMIN" | "DOCTOR" | "ASSISTANT";

export type StaffAccountInput = {
  username: string;
  displayName: string;
  passwordHash: string;
  role: StaffRole;
};

/** Account metadata excludes all patient identifiers and clinical information. */
export async function listStaffAccounts() {
  const db = await requiredDb();
  return db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      isActive: users.isActive,
      mustChangePassword: users.mustChangePassword,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .orderBy(asc(users.username));
}

export async function createStaffAccount(input: StaffAccountInput, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const result = await tx.insert(users).values({
      username: input.username,
      displayName: input.displayName,
      passwordHash: input.passwordHash,
      role: input.role,
      mustChangePassword: false,
    }).returning({ id: users.id });
    const userId = Number(getInsertId(result));
    await tx.insert(auditEvents).values({
      action: "STAFF_ACCOUNT_CREATED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "USER",
      entityId: String(userId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ role: input.role }),
    });
    const created = await tx
      .select({ id: users.id, username: users.username, displayName: users.displayName, role: users.role, isActive: users.isActive, mustChangePassword: users.mustChangePassword, lastLoginAt: users.lastLoginAt, createdAt: users.createdAt, updatedAt: users.updatedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!created[0]) throw new Error("STAFF_ACCOUNT_CREATE_FAILED");
    return created[0];
  });
}

export async function updateStaffRole(targetUserId: number, role: StaffRole, audit: AuditContext) {
  if (targetUserId === audit.actorUserId) throw new Error("SELF_ACCOUNT_CHANGE_NOT_ALLOWED");
  const db = await requiredDb();
  return db.transaction(async tx => {
    const target = await tx.select({ id: users.id, role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!target[0]) throw new Error("STAFF_ACCOUNT_NOT_FOUND");
    if (target[0].role === "SYSTEM_ADMIN" && target[0].isActive && role !== "SYSTEM_ADMIN") {
      const activeAdmins = await tx.select({ value: count() }).from(users).where(and(eq(users.role, "SYSTEM_ADMIN"), eq(users.isActive, true)));
      if (Number(activeAdmins[0]?.value ?? 0) <= 1) throw new Error("LAST_ACTIVE_ADMIN");
    }
    await tx.update(users).set({ role }).where(eq(users.id, targetUserId));
    await tx.insert(auditEvents).values({
      action: "STAFF_ROLE_CHANGED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "USER",
      entityId: String(targetUserId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ fromRole: target[0].role, toRole: role }),
    });
    return { id: targetUserId, role };
  });
}

export async function setStaffAccountActive(targetUserId: number, isActive: boolean, audit: AuditContext) {
  if (targetUserId === audit.actorUserId) throw new Error("SELF_ACCOUNT_CHANGE_NOT_ALLOWED");
  const db = await requiredDb();
  return db.transaction(async tx => {
    const target = await tx.select({ id: users.id, role: users.role, isActive: users.isActive }).from(users).where(eq(users.id, targetUserId)).limit(1);
    if (!target[0]) throw new Error("STAFF_ACCOUNT_NOT_FOUND");
    if (target[0].isActive === isActive) return { id: targetUserId, isActive, unchanged: true };
    if (!isActive && target[0].role === "SYSTEM_ADMIN") {
      const activeAdmins = await tx.select({ value: count() }).from(users).where(and(eq(users.role, "SYSTEM_ADMIN"), eq(users.isActive, true)));
      if (Number(activeAdmins[0]?.value ?? 0) <= 1) throw new Error("LAST_ACTIVE_ADMIN");
    }
    const now = new Date();
    await tx.update(users).set({ isActive, failedLoginCount: 0, lockedUntil: null }).where(eq(users.id, targetUserId));
    if (!isActive) await tx.update(userSessions).set({ revokedAt: now }).where(and(eq(userSessions.userId, targetUserId), isNull(userSessions.revokedAt)));
    await tx.insert(auditEvents).values({
      action: isActive ? "STAFF_ACCOUNT_ACTIVATED" : "STAFF_ACCOUNT_DEACTIVATED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "USER",
      entityId: String(targetUserId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ role: target[0].role, sessionsRevoked: !isActive }),
    });
    return { id: targetUserId, isActive, unchanged: false };
  });
}

export type AuditContext = {
  actorUserId: number;
  actorRole: "SYSTEM_ADMIN" | "DOCTOR" | "ASSISTANT";
  requestId: string;
};

export type PatientRegistrationInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";
  phone?: string | null;
  address?: string | null;
  allergySummary?: string | null;
  idDocumentType: IdentityDocumentType;
  idDocumentNumber: string;
  consentAccepted?: boolean;
};

function validateDateOnly(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("INVALID_DATE");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("INVALID_DATE");
  return value;
}

function safeAuditMetadata(value: Record<string, string | number | boolean>) {
  return JSON.stringify(value);
}

export async function checkDuplicatePatients(input: { firstName: string; lastName: string; dateOfBirth?: string | null }) {
  const db = await requiredDb();
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName) return [];

  const conditions = [
    and(eq(patients.firstName, firstName), eq(patients.lastName, lastName)),
  ];

  if (input.dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(input.dateOfBirth)) {
    conditions.push(and(eq(patients.firstName, firstName), eq(patients.dateOfBirth, input.dateOfBirth)));
  }

  return db
    .select({
      id: patients.id,
      hn: patients.hn,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      gender: patients.gender,
      phone: patients.phone,
      idDocumentType: patients.idDocumentType,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .where(or(...conditions))
    .limit(10);
}

export async function createPatient(input: PatientRegistrationInput, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    // A short random placeholder permits allocating the database id first; it is
    // replaced within the same transaction by the permanent, sequential HN.
    const temporaryHn = `P${randomBytes(10).toString("hex")}`;
    const { idDocumentType, idDocumentNumber, consentAccepted, ...patientInput } = input;
    const normalizedIdDocumentNumber = idDocumentType === "THAI_NATIONAL_ID"
      ? normalizeThaiNationalId(idDocumentNumber)
      : normalizePassportNumber(idDocumentNumber);
    const documentIsValid = idDocumentType === "THAI_NATIONAL_ID"
      ? isValidThaiNationalId(normalizedIdDocumentNumber)
      : isValidPassportNumber(normalizedIdDocumentNumber);
    if (!documentIsValid) throw new Error(idDocumentType === "THAI_NATIONAL_ID" ? "INVALID_NATIONAL_ID" : "INVALID_PASSPORT");
    const now = new Date();
    const ciphertext = encryptIdentityDocument(normalizedIdDocumentNumber);
    const lookupHash = identityDocumentLookupHash(normalizedIdDocumentNumber);
    const result = await tx.insert(patients).values({
      ...patientInput,
      dateOfBirth: validateDateOnly(patientInput.dateOfBirth),
      hn: temporaryHn,
      createdBy: audit.actorUserId,
      idDocumentType,
      nationalIdCiphertext: idDocumentType === "THAI_NATIONAL_ID" ? ciphertext : null,
      nationalIdLookupHash: idDocumentType === "THAI_NATIONAL_ID" ? lookupHash : null,
      nationalIdSetAt: idDocumentType === "THAI_NATIONAL_ID" ? now : null,
      nationalIdSetBy: idDocumentType === "THAI_NATIONAL_ID" ? audit.actorUserId : null,
      passportCiphertext: idDocumentType === "PASSPORT" ? ciphertext : null,
      passportLookupHash: idDocumentType === "PASSPORT" ? lookupHash : null,
      passportSetAt: idDocumentType === "PASSPORT" ? now : null,
      passportSetBy: idDocumentType === "PASSPORT" ? audit.actorUserId : null,
    }).returning({ id: patients.id });
    const patientId = Number(getInsertId(result));
    const hn = `HN${String(patientId).padStart(8, "0")}`;
    await tx.update(patients).set({ hn }).where(eq(patients.id, patientId));
    await tx.insert(auditEvents).values({
      action: "PATIENT_REGISTERED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "PATIENT",
      entityId: String(patientId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ source: "front_desk", identityDocumentType: idDocumentType, identityDocumentRecorded: true, consentAccepted: Boolean(consentAccepted) }),
    });
    const created = await tx.select(patientClientSelection).from(patients).where(eq(patients.id, patientId)).limit(1);
    if (!created[0]) throw new Error("PATIENT_CREATE_FAILED");
    return {
      ...created[0],
      identityDocumentMasked: idDocumentType === "THAI_NATIONAL_ID"
        ? maskThaiNationalId(normalizedIdDocumentNumber)
        : maskPassportNumber(normalizedIdDocumentNumber),
    };
  });
}

export async function findPatientByHn(hn: string) {
  const db = await requiredDb();
  const result = await db.select(patientClientSelection).from(patients).where(eq(patients.hn, hn.trim().toUpperCase())).limit(1);
  return result[0] ?? null;
}

const patientClientSelection = {
  id: patients.id,
  hn: patients.hn,
  firstName: patients.firstName,
  lastName: patients.lastName,
  dateOfBirth: patients.dateOfBirth,
  gender: patients.gender,
  phone: patients.phone,
  address: patients.address,
  allergySummary: patients.allergySummary,
  idDocumentType: patients.idDocumentType,
  createdBy: patients.createdBy,
  createdAt: patients.createdAt,
  updatedAt: patients.updatedAt,
};

export async function getPatientNationalIdStatus(patientId: number) {
  const db = await requiredDb();
  const result = await db.select({ ciphertext: patients.nationalIdCiphertext }).from(patients).where(eq(patients.id, patientId)).limit(1);
  const encryptedNationalId = result[0]?.ciphertext;
  if (!result[0]) throw new Error("PATIENT_NOT_FOUND");
  if (!encryptedNationalId) return { isSet: false, nationalIdMasked: null as string | null };
  return { isSet: true, nationalIdMasked: maskThaiNationalId(decryptNationalId(encryptedNationalId)) };
}

export async function recordPatientNationalId(input: { patientId: number; nationalId: string; source: "ASSISTANT_ENTRY" | "LOCAL_SMART_CARD_BRIDGE" }, audit: AuditContext) {
  const normalizedNationalId = normalizeThaiNationalId(input.nationalId);
  if (!isValidThaiNationalId(normalizedNationalId)) throw new Error("INVALID_NATIONAL_ID");
  const db = await requiredDb();
  return db.transaction(async tx => {
    const patient = await tx.select({ id: patients.id, idDocumentType: patients.idDocumentType, nationalIdCiphertext: patients.nationalIdCiphertext }).from(patients).where(eq(patients.id, input.patientId)).limit(1);
    if (!patient[0]) throw new Error("PATIENT_NOT_FOUND");
    if (patient[0].idDocumentType || patient[0].nationalIdCiphertext) throw new Error("NATIONAL_ID_WRITE_ONCE");
    const updateResult = await tx.update(patients).set({
      idDocumentType: "THAI_NATIONAL_ID",
      nationalIdCiphertext: encryptNationalId(normalizedNationalId),
      nationalIdLookupHash: nationalIdLookupHash(normalizedNationalId),
      nationalIdSetAt: new Date(),
      nationalIdSetBy: audit.actorUserId,
    }).where(and(eq(patients.id, input.patientId), isNull(patients.idDocumentType), isNull(patients.nationalIdCiphertext)));
    if (getAffectedRows(updateResult) !== 1) throw new Error("NATIONAL_ID_WRITE_ONCE");
    await tx.insert(auditEvents).values({
      action: "PATIENT_NATIONAL_ID_RECORDED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "PATIENT",
      entityId: String(input.patientId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ source: input.source, writeOnce: true }),
    });
    return { isSet: true, nationalIdMasked: maskThaiNationalId(normalizedNationalId) };
  });
}

export async function searchPatients(query: string) {
  const db = await requiredDb();
  const term = query.trim();
  if (!term) return [];
  return db
    .select({
      id: patients.id,
      hn: patients.hn,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      gender: patients.gender,
      phone: patients.phone,
      idDocumentType: patients.idDocumentType,
      createdAt: patients.createdAt,
    })
    .from(patients)
    .where(or(eq(patients.hn, term.toUpperCase()), like(patients.firstName, `%${term}%`), like(patients.lastName, `%${term}%`)))
    .orderBy(desc(patients.createdAt))
    .limit(25);
}

export async function createVisit(input: { patientId: number; visitDate: string; chiefComplaint: string }, audit: AuditContext) {
  const db = await requiredDb();
  const visitDate = validateDateOnly(input.visitDate);
  return db.transaction(async tx => {
    const patient = await tx.select({ id: patients.id }).from(patients).where(eq(patients.id, input.patientId)).limit(1);
    if (!patient[0]) throw new Error("PATIENT_NOT_FOUND");
    const visitResult = await tx.insert(visits).values({
      patientId: input.patientId,
      visitDate,
      chiefComplaint: input.chiefComplaint,
      createdBy: audit.actorUserId,
    }).returning({ id: visits.id });
    const visitId = Number(getInsertId(visitResult));
    const queueResult = await tx.insert(queueEntries).values({ visitId, queueDate: visitDate, queueNumber: visitId }).returning({ id: queueEntries.id });
    const queueId = Number(getInsertId(queueResult));
    await tx.insert(auditEvents).values({
      action: "VISIT_CREATED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "VISIT",
      entityId: String(visitId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ queueEntryId: queueId, queueNumber: visitId }),
    });
    return { visitId, queueId, queueNumber: visitId, visitDate };
  });
}

export async function listQueueByDate(queueDateInput: string) {
  const db = await requiredDb();
  const queueDate = validateDateOnly(queueDateInput);
  return db
    .select({
      queueId: queueEntries.id,
      queueNumber: queueEntries.queueNumber,
      queueStatus: queueEntries.status,
      queueDate: queueEntries.queueDate,
      assignedTo: queueEntries.assignedTo,
      calledAt: queueEntries.calledAt,
      completedAt: queueEntries.completedAt,
      visitId: visits.id,
      visitStatus: visits.status,
      chiefComplaint: visits.chiefComplaint,
      patientId: patients.id,
      hn: patients.hn,
      firstName: patients.firstName,
      lastName: patients.lastName,
      allergySummary: patients.allergySummary,
      triageUrgency: triageRecords.urgency,
      triagePerformedAt: triageRecords.performedAt,
      bloodPressureSystolic: triageRecords.bloodPressureSystolic,
      bloodPressureDiastolic: triageRecords.bloodPressureDiastolic,
      pulse: triageRecords.pulse,
      temperatureCelsius: triageRecords.temperatureCelsius,
      oxygenSaturation: triageRecords.oxygenSaturation,
      weightKg: triageRecords.weightKg,
      heightCm: triageRecords.heightCm,
      triageNote: triageRecords.triageNote,
    })
    .from(queueEntries)
    .innerJoin(visits, eq(queueEntries.visitId, visits.id))
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .leftJoin(triageRecords, eq(triageRecords.visitId, visits.id))
    .where(eq(queueEntries.queueDate, queueDate))
    .orderBy(asc(queueEntries.queueNumber));
}

export type TriageInput = {
  visitId: number;
  bloodPressureSystolic?: number | null;
  bloodPressureDiastolic?: number | null;
  pulse?: number | null;
  temperatureCelsius?: string | null;
  oxygenSaturation?: number | null;
  weightKg?: string | null;
  heightCm?: string | null;
  triageNote?: string | null;
  urgency: "ROUTINE" | "PRIORITY" | "URGENT";
};

export async function upsertTriageRecord(input: TriageInput, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const visit = await tx.select({ id: visits.id, status: visits.status }).from(visits).where(eq(visits.id, input.visitId)).limit(1);
    if (!visit[0]) throw new Error("VISIT_NOT_FOUND");
    if (!["REGISTERED", "TRIAGED", "WAITING_DOCTOR"].includes(visit[0].status)) throw new Error("TRIAGE_NOT_ALLOWED_FOR_VISIT_STATE");
    const existing = await tx.select({ id: triageRecords.id }).from(triageRecords).where(eq(triageRecords.visitId, input.visitId)).limit(1);
    const values = { ...input, performedBy: audit.actorUserId, performedAt: new Date() };
    let triageId: number;
    let action: "TRIAGE_RECORDED" | "TRIAGE_UPDATED";
    if (existing[0]) {
      triageId = existing[0].id;
      action = "TRIAGE_UPDATED";
      await tx.update(triageRecords).set(values).where(eq(triageRecords.id, triageId));
    } else {
      const result = await tx.insert(triageRecords).values(values).returning({ id: triageRecords.id });
      triageId = Number(getInsertId(result));
      action = "TRIAGE_RECORDED";
    }
    await tx.update(visits).set({ status: "WAITING_DOCTOR" }).where(eq(visits.id, input.visitId));
    await tx.insert(auditEvents).values({
      action,
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "TRIAGE_RECORD",
      entityId: String(triageId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ visitId: input.visitId, urgency: input.urgency }),
    });
    return { triageId, visitId: input.visitId, urgency: input.urgency, action };
  });
}

export async function callNextQueue(queueDateInput: string, doctorId: number, audit: AuditContext) {
  const db = await requiredDb();
  const queueDate = validateDateOnly(queueDateInput);
  return db.transaction(async tx => {
    const next = await tx
      .select({ queueId: queueEntries.id, visitId: visits.id, queueNumber: queueEntries.queueNumber })
      .from(queueEntries)
      .innerJoin(visits, eq(queueEntries.visitId, visits.id))
      .where(and(eq(queueEntries.queueDate, queueDate), eq(queueEntries.status, "WAITING"), eq(visits.status, "WAITING_DOCTOR")))
      .orderBy(asc(queueEntries.queueNumber))
      .limit(1);
    if (!next[0]) return null;
    const now = new Date();
    await tx.update(queueEntries).set({ status: "CALLED", assignedTo: doctorId, calledAt: now }).where(eq(queueEntries.id, next[0].queueId));
    await tx.update(visits).set({ status: "IN_CONSULT" }).where(eq(visits.id, next[0].visitId));
    await tx.insert(auditEvents).values({
      action: "QUEUE_CALLED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "QUEUE_ENTRY",
      entityId: String(next[0].queueId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ queueNumber: next[0].queueNumber, visitId: next[0].visitId }),
    });
    return { ...next[0], calledAt: now };
  });
}

export type ClinicalDraftInput = {
  visitId: number;
  expectedRevision: number;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
};

export type SignClinicalEncounterInput = ClinicalDraftInput & {
  expectedVisitVersion: number;
  diagnoses: Array<{ code?: string | null; display: string }>;
  medications?: Array<{
    medicationId: number;
    dose: string;
    frequency: string;
    duration?: string | null;
    quantityPrescribed: number;
    instructions?: string | null;
  }>;
};

type ClinicTransaction = PgTransaction<any, any, any>;

async function getAssignedConsultation(tx: ClinicTransaction, visitId: number, doctorId: number) {
  const encounter = await tx
    .select({
      queueId: queueEntries.id,
      queueStatus: queueEntries.status,
      assignedTo: queueEntries.assignedTo,
      visitId: visits.id,
      visitStatus: visits.status,
      visitVersion: visits.version,
      chiefComplaint: visits.chiefComplaint,
      patientId: patients.id,
      hn: patients.hn,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      gender: patients.gender,
      allergySummary: patients.allergySummary,
      bloodPressureSystolic: triageRecords.bloodPressureSystolic,
      bloodPressureDiastolic: triageRecords.bloodPressureDiastolic,
      pulse: triageRecords.pulse,
      temperatureCelsius: triageRecords.temperatureCelsius,
      oxygenSaturation: triageRecords.oxygenSaturation,
      weightKg: triageRecords.weightKg,
      heightCm: triageRecords.heightCm,
      triageNote: triageRecords.triageNote,
      triageUrgency: triageRecords.urgency,
    })
    .from(queueEntries)
    .innerJoin(visits, eq(queueEntries.visitId, visits.id))
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .leftJoin(triageRecords, eq(triageRecords.visitId, visits.id))
    .where(and(eq(visits.id, visitId), eq(queueEntries.assignedTo, doctorId)))
    .limit(1);
  if (!encounter[0]) throw new Error("CONSULTATION_NOT_ASSIGNED_TO_DOCTOR");
  if (encounter[0].visitStatus !== "IN_CONSULT" || encounter[0].queueStatus !== "CALLED") throw new Error("CONSULTATION_NOT_ACTIVE");
  return encounter[0];
}

/** Returns only the selected doctor's active consultation, never an unassigned patient record. */
export async function getDoctorConsultation(visitId: number, doctorId: number) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const encounter = await getAssignedConsultation(tx, visitId, doctorId);
    const [note] = await tx.select().from(clinicalNotes).where(eq(clinicalNotes.visitId, visitId)).limit(1);
    const diagnoses = await tx.select({ id: visitDiagnoses.id, code: visitDiagnoses.code, display: visitDiagnoses.display, rank: visitDiagnoses.rank }).from(visitDiagnoses).where(eq(visitDiagnoses.visitId, visitId)).orderBy(asc(visitDiagnoses.rank));
    return { ...encounter, note: note ?? null, diagnoses };
  });
}

export async function saveClinicalDraft(input: ClinicalDraftInput, doctorId: number, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    await getAssignedConsultation(tx, input.visitId, doctorId);
    const [existing] = await tx.select().from(clinicalNotes).where(eq(clinicalNotes.visitId, input.visitId)).limit(1);
    const fields = { subjective: input.subjective ?? null, objective: input.objective ?? null, assessment: input.assessment ?? null, plan: input.plan ?? null };
    let noteId: number;
    let revision: number;
    if (!existing) {
      if (input.expectedRevision !== 0) throw new Error("STALE_CLINICAL_NOTE");
      const result = await tx.insert(clinicalNotes).values({ visitId: input.visitId, ...fields, status: "DRAFT", revision: 1, authoredBy: doctorId }).returning({ id: clinicalNotes.id });
      noteId = Number(getInsertId(result));
      revision = 1;
    } else {
      if (existing.status === "SIGNED") throw new Error("CLINICAL_NOTE_ALREADY_SIGNED");
      if (existing.authoredBy !== doctorId) throw new Error("CLINICAL_NOTE_AUTHORED_BY_ANOTHER_DOCTOR");
      if (existing.revision !== input.expectedRevision) throw new Error("STALE_CLINICAL_NOTE");
      revision = existing.revision + 1;
      const result = await tx.update(clinicalNotes).set({ ...fields, revision }).where(and(eq(clinicalNotes.id, existing.id), eq(clinicalNotes.revision, input.expectedRevision)));
      if (Number(getAffectedRows(result)) !== 1) throw new Error("STALE_CLINICAL_NOTE");
      noteId = existing.id;
    }
    await tx.insert(auditEvents).values({
      action: "CLINICAL_NOTE_DRAFT_SAVED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "CLINICAL_NOTE",
      entityId: String(noteId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ visitId: input.visitId, revision }),
    });
    return { noteId, visitId: input.visitId, revision, status: "DRAFT" as const };
  });
}

export async function signClinicalEncounter(input: SignClinicalEncounterInput, doctorId: number, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const encounter = await getAssignedConsultation(tx, input.visitId, doctorId);
    if (encounter.visitVersion !== input.expectedVisitVersion) throw new Error("STALE_VISIT");
    const [existing] = await tx.select().from(clinicalNotes).where(eq(clinicalNotes.visitId, input.visitId)).limit(1);
    const fields = { subjective: input.subjective ?? null, objective: input.objective ?? null, assessment: input.assessment ?? null, plan: input.plan ?? null };
    const now = new Date();
    let noteId: number;
    let revision: number;
    if (!existing) {
      if (input.expectedRevision !== 0) throw new Error("STALE_CLINICAL_NOTE");
      const result = await tx.insert(clinicalNotes).values({ visitId: input.visitId, ...fields, status: "SIGNED", revision: 1, authoredBy: doctorId, signedAt: now }).returning({ id: clinicalNotes.id });
      noteId = Number(getInsertId(result));
      revision = 1;
    } else {
      if (existing.status === "SIGNED") throw new Error("CLINICAL_NOTE_ALREADY_SIGNED");
      if (existing.authoredBy !== doctorId) throw new Error("CLINICAL_NOTE_AUTHORED_BY_ANOTHER_DOCTOR");
      if (existing.revision !== input.expectedRevision) throw new Error("STALE_CLINICAL_NOTE");
      revision = existing.revision + 1;
      const result = await tx.update(clinicalNotes).set({ ...fields, status: "SIGNED", revision, signedAt: now }).where(and(eq(clinicalNotes.id, existing.id), eq(clinicalNotes.revision, input.expectedRevision)));
      if (Number(getAffectedRows(result)) !== 1) throw new Error("STALE_CLINICAL_NOTE");
      noteId = existing.id;
    }
    await tx.insert(visitDiagnoses).values(input.diagnoses.map((diagnosis, index) => ({ visitId: input.visitId, code: diagnosis.code ?? null, display: diagnosis.display, rank: index + 1, enteredBy: doctorId })));

    const orderedMedicationIds = input.medications?.map(item => item.medicationId) ?? [];
    if (new Set(orderedMedicationIds).size !== orderedMedicationIds.length) throw new Error("DUPLICATE_MEDICATION_ORDER_ITEM");
    let clinicalOrderId: number | null = null;
    if (input.medications?.length) {
      const selectedMedications = await Promise.all(input.medications.map(async item => {
        const [medication] = await tx.select().from(medications).where(and(eq(medications.id, item.medicationId), eq(medications.isActive, true))).limit(1);
        if (!medication) throw new Error("MEDICATION_NOT_FOUND_OR_INACTIVE");
        return { item, medication };
      }));
      const orderResult = await tx.insert(clinicalOrders).values({ visitId: input.visitId, status: "SIGNED", createdBy: doctorId, signedBy: doctorId, signedAt: now, signRequestId: audit.requestId }).returning({ id: clinicalOrders.id });
      clinicalOrderId = Number(getInsertId(orderResult));
      await tx.insert(medicationOrderItems).values(selectedMedications.map(({ item, medication }) => ({
        clinicalOrderId: clinicalOrderId!,
        medicationId: medication.id,
        medicationNameSnapshot: [medication.genericName, medication.tradeName].filter(Boolean).join(" · "),
        dosageFormSnapshot: medication.dosageForm,
        strengthSnapshot: medication.strength,
        dose: item.dose,
        frequency: item.frequency,
        duration: item.duration ?? null,
        quantityPrescribed: item.quantityPrescribed,
        instructions: item.instructions ?? null,
      })));
    }
    // Every signed encounter proceeds through Cashier, even when the doctor did
    // not prescribe medication. Only a paid invoice may subsequently close it.
    const nextVisitStatus = "DISPENSING";
    const visitUpdate = await tx.update(visits).set({ status: nextVisitStatus, version: encounter.visitVersion + 1 }).where(and(eq(visits.id, input.visitId), eq(visits.version, input.expectedVisitVersion), eq(visits.status, "IN_CONSULT")));
    if (Number(getAffectedRows(visitUpdate)) !== 1) throw new Error("STALE_VISIT");
    await tx.update(queueEntries).set({ status: "COMPLETED", completedAt: now }).where(and(eq(queueEntries.id, encounter.queueId), eq(queueEntries.status, "CALLED")));
    await tx.insert(auditEvents).values({
      action: "CLINICAL_ENCOUNTER_SIGNED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "CLINICAL_NOTE",
      entityId: String(noteId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ visitId: input.visitId, revision, diagnosisCount: input.diagnoses.length, medicationCount: input.medications?.length ?? 0 }),
    });
    if (clinicalOrderId) {
      await tx.insert(auditEvents).values({
        action: "MEDICATION_ORDER_SIGNED",
        actorUserId: audit.actorUserId,
        actorRole: audit.actorRole,
        entityType: "CLINICAL_ORDER",
        entityId: String(clinicalOrderId),
        outcome: "ALLOWED",
        requestId: audit.requestId,
        metadata: safeAuditMetadata({ visitId: input.visitId, itemCount: input.medications?.length ?? 0 }),
      });
    }
    return { visitId: input.visitId, noteId, revision, signedAt: now, status: "SIGNED" as const, clinicalOrderId, visitStatus: nextVisitStatus };
  });
}

export type ClinicalPresetInput = {
  name: string;
  description?: string | null;
  diagnoses: Array<{ code?: string | null; display: string }>;
  medications: Array<{
    medicationId: number;
    dose: string;
    frequency: string;
    duration?: string | null;
    quantityPrescribed: number;
    instructions?: string | null;
  }>;
};

export async function listClinicalPresets(doctorId: number) {
  const db = await requiredDb();
  const presets = await db
    .select()
    .from(clinicalPresets)
    .where(eq(clinicalPresets.doctorId, doctorId))
    .orderBy(desc(clinicalPresets.createdAt));

  return presets.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    diagnoses: JSON.parse(p.diagnosesJson || "[]") as Array<{ code?: string; display: string }>,
    medications: JSON.parse(p.medicationsJson || "[]") as Array<{
      medicationId: number;
      dose: string;
      frequency: string;
      duration?: string | null;
      quantityPrescribed: number;
      instructions?: string | null;
    }>,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

export async function createClinicalPreset(input: ClinicalPresetInput, doctorId: number, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const result = await tx.insert(clinicalPresets).values({
      doctorId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      diagnosesJson: JSON.stringify(input.diagnoses),
      medicationsJson: JSON.stringify(input.medications),
    }).returning({ id: clinicalPresets.id });
    const presetId = Number(getInsertId(result));
    await tx.insert(auditEvents).values({
      action: "CLINICAL_PRESET_CREATED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "CLINICAL_PRESET",
      entityId: String(presetId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ name: input.name }),
    });
    return { id: presetId, name: input.name };
  });
}

export async function deleteClinicalPreset(presetId: number, doctorId: number, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(clinicalPresets)
      .where(and(eq(clinicalPresets.id, presetId), eq(clinicalPresets.doctorId, doctorId)))
      .limit(1);
    if (!existing) throw new Error("PRESET_NOT_FOUND");
    await tx.delete(clinicalPresets).where(eq(clinicalPresets.id, presetId));
    await tx.insert(auditEvents).values({
      action: "CLINICAL_PRESET_DELETED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "CLINICAL_PRESET",
      entityId: String(presetId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ name: existing.name }),
    });
    return { id: presetId, success: true };
  });
}

export async function listSoapTemplates(filters?: { serviceType?: string }) {
  const db = await requiredDb();
  const where = filters?.serviceType
    ? and(eq(soapTemplates.serviceType, filters.serviceType), eq(soapTemplates.isActive, true))
    : eq(soapTemplates.isActive, true);
  return db.select().from(soapTemplates).where(where).orderBy(soapTemplates.name);
}

export async function createSoapTemplate(input: {
  serviceType: string;
  name: string;
  subjectiveTemplate: string;
  objectiveTemplate: string;
  assessmentTemplate: string;
  planTemplate: string;
  createdBy: number;
}, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const result = await tx.insert(soapTemplates).values({
      serviceType: input.serviceType,
      name: input.name.trim(),
      subjectiveTemplate: input.subjectiveTemplate,
      objectiveTemplate: input.objectiveTemplate,
      assessmentTemplate: input.assessmentTemplate,
      planTemplate: input.planTemplate,
      createdBy: input.createdBy,
    }).returning({ id: soapTemplates.id });
    const templateId = Number(getInsertId(result));
    await tx.insert(auditEvents).values({
      action: "SOAP_TEMPLATE_CREATED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "SOAP_TEMPLATE",
      entityId: String(templateId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ name: input.name, serviceType: input.serviceType }),
    });
    return { id: templateId };
  });
}

export async function updateSoapTemplate(templateId: number, patch: {
  name?: string;
  subjectiveTemplate?: string;
  objectiveTemplate?: string;
  assessmentTemplate?: string;
  planTemplate?: string;
  isActive?: boolean;
}, audit: AuditContext) {
  const db = await requiredDb();
  const [existing] = await db.select().from(soapTemplates).where(eq(soapTemplates.id, templateId)).limit(1);
  if (!existing) throw new Error("SOAP_TEMPLATE_NOT_FOUND");
  return db.transaction(async tx => {
    await tx.update(soapTemplates).set(patch).where(eq(soapTemplates.id, templateId));
    await tx.insert(auditEvents).values({
      action: "SOAP_TEMPLATE_UPDATED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "SOAP_TEMPLATE",
      entityId: String(templateId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ name: existing.name, patch: Object.keys(patch).join(",") }),
    });
    return { id: templateId };
  });
}

export async function deactivateSoapTemplate(templateId: number, audit: AuditContext) {
  const db = await requiredDb();
  const [existing] = await db.select().from(soapTemplates).where(eq(soapTemplates.id, templateId)).limit(1);
  if (!existing) throw new Error("SOAP_TEMPLATE_NOT_FOUND");
  return db.transaction(async tx => {
    await tx.update(soapTemplates).set({ isActive: false }).where(eq(soapTemplates.id, templateId));
    await tx.insert(auditEvents).values({
      action: "SOAP_TEMPLATE_DEACTIVATED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "SOAP_TEMPLATE",
      entityId: String(templateId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ name: existing.name }),
    });
    return { id: templateId };
  });
}

export interface MedicationRow {
  code: string;
  genericName: string;
  tradeName?: string | null;
  dosageForm: string;
  strength: string;
}

export async function listActiveMedications(query?: string) {
  const db = await requiredDb();
  const term = query?.trim() ?? "";
  const medRows = await db
    .select({
      id: medications.id,
      code: medications.code,
      genericName: medications.genericName,
      tradeName: medications.tradeName,
      dosageForm: medications.dosageForm,
      strength: medications.strength,
      minStockThreshold: medications.minStockThreshold,
    })
    .from(medications)
    .where(and(eq(medications.isActive, true), term ? or(like(medications.code, `%${term}%`), like(medications.genericName, `%${term}%`), like(medications.tradeName, `%${term}%`)) : undefined))
    .orderBy(asc(medications.genericName))
    .limit(100);

  if (medRows.length === 0) return [];

  const stockRows = await db
    .select({
      medicationId: inventoryLots.medicationId,
      remainingQuantity: sql<number>`coalesce(sum(${inventoryLots.remainingQuantity}), 0)`,
    })
    .from(inventoryLots)
    .where(or(...medRows.map(m => eq(inventoryLots.medicationId, m.id))))
    .groupBy(inventoryLots.medicationId);

  const stockMap = new Map(stockRows.map(r => [r.medicationId, Number(r.remainingQuantity ?? 0)]));

  return medRows.map(m => {
    const onHandQuantity = stockMap.get(m.id) ?? 0;
    return {
      ...m,
      onHandQuantity,
      isLowStock: onHandQuantity <= m.minStockThreshold,
    };
  });
}

export async function updateMedicationMinStockThreshold(input: { medicationId: number; minStockThreshold: number }, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const [medication] = await tx.select({ id: medications.id }).from(medications).where(eq(medications.id, input.medicationId)).limit(1);
    if (!medication) throw new Error("MEDICATION_NOT_FOUND");
    await tx.update(medications).set({ minStockThreshold: input.minStockThreshold }).where(eq(medications.id, input.medicationId));
    await tx.insert(auditEvents).values({
      action: "MEDICATION_THRESHOLD_UPDATED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "MEDICATION",
      entityId: String(input.medicationId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ medicationId: input.medicationId, minStockThreshold: input.minStockThreshold }),
    });
    return { medicationId: input.medicationId, minStockThreshold: input.minStockThreshold };
  });
}

export interface MedicationCatalogInput {
  code: string;
  genericName: string;
  tradeName?: string | null;
  dosageForm: string;
  strength: string;
  minStockThreshold?: number;
  isActive?: boolean;
}

export async function createMedicationCatalogItem(input: MedicationCatalogInput, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const result = await tx.insert(medications).values({ ...input, code: input.code.trim().toUpperCase(), tradeName: input.tradeName ?? null, createdBy: audit.actorUserId }).returning({ id: medications.id });
    const medicationId = Number(getInsertId(result));
    await tx.insert(auditEvents).values({
      action: "MEDICATION_CATALOG_CREATED", actorUserId: audit.actorUserId, actorRole: audit.actorRole, entityType: "MEDICATION", entityId: String(medicationId), outcome: "ALLOWED", requestId: audit.requestId,
      metadata: safeAuditMetadata({ source: "system_admin" }),
    });
    const [created] = await tx.select().from(medications).where(eq(medications.id, medicationId)).limit(1);
    if (!created) throw new Error("MEDICATION_CREATE_FAILED");
    return created;
  });
}

export async function setMedicationUnitPrice(input: { medicationId: number; unitPriceSatang: number }, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const [medication] = await tx.select({ id: medications.id }).from(medications).where(eq(medications.id, input.medicationId)).limit(1);
    if (!medication) throw new Error("MEDICATION_NOT_FOUND");
    const now = new Date();
    await tx.update(medicationPrices).set({ isActive: false, effectiveTo: now }).where(and(eq(medicationPrices.medicationId, input.medicationId), eq(medicationPrices.isActive, true)));
    const result = await tx.insert(medicationPrices).values({ medicationId: input.medicationId, unitPriceSatang: input.unitPriceSatang, effectiveFrom: now, isActive: true, createdBy: audit.actorUserId }).returning({ id: medicationPrices.id });
    const priceId = Number(getInsertId(result));
    await tx.insert(auditEvents).values({
      action: "MEDICATION_PRICE_SET", actorUserId: audit.actorUserId, actorRole: audit.actorRole, entityType: "MEDICATION_PRICE", entityId: String(priceId), outcome: "ALLOWED", requestId: audit.requestId,
      metadata: safeAuditMetadata({ medicationId: input.medicationId, unitPriceSatang: input.unitPriceSatang }),
    });
    return { priceId, medicationId: input.medicationId, unitPriceSatang: input.unitPriceSatang, effectiveFrom: now };
  });
}

export type BulkMedicationCatalogImportRow = MedicationCatalogInput & {
  unitPriceSatang: number;
};

/** Creates medication master data and their first active price as one all-or-nothing transaction. */
export async function bulkImportMedicationCatalog(rows: BulkMedicationCatalogImportRow[], audit: AuditContext) {
  if (rows.length === 0) throw new Error("MEDICATION_IMPORT_EMPTY");
  const normalizedRows = rows.map(row => ({
    ...row,
    code: row.code.trim().toUpperCase(),
    genericName: row.genericName.trim(),
    tradeName: row.tradeName?.trim() || null,
    dosageForm: row.dosageForm.trim(),
    strength: row.strength.trim(),
  }));
  const codes = normalizedRows.map(row => row.code);
  if (new Set(codes).size !== codes.length) throw new Error("DUPLICATE_MEDICATION_CODE");

  const db = await requiredDb();
  return db.transaction(async tx => {
    const existing = await tx.select({ code: medications.code }).from(medications).where(or(...codes.map(code => eq(medications.code, code))));
    if (existing.length > 0) throw new Error("MEDICATION_CODE_ALREADY_EXISTS");

    const now = new Date();
    const medicationIds: number[] = [];
    for (const row of normalizedRows) {
      const medicationResult = await tx.insert(medications).values({
        code: row.code,
        genericName: row.genericName,
        tradeName: row.tradeName,
        dosageForm: row.dosageForm,
        strength: row.strength,
        createdBy: audit.actorUserId,
      }).returning({ id: medications.id });
      const medicationId = Number(getInsertId(medicationResult));
      medicationIds.push(medicationId);
      await tx.insert(medicationPrices).values({
        medicationId,
        unitPriceSatang: row.unitPriceSatang,
        effectiveFrom: now,
        isActive: true,
        createdBy: audit.actorUserId,
      });
    }
    await tx.insert(auditEvents).values({
      action: "MEDICATION_CATALOG_BULK_IMPORTED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "MEDICATION_CATALOG",
      entityId: String(medicationIds[0]),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ source: "csv_import", importedCount: normalizedRows.length }),
    });
    return { importedCount: medicationIds.length, medicationIds };
  });
}

export async function receiveInventoryLot(input: { medicationId: number; lotNumber: string; expiryDate: string; quantity: number; idempotencyKey: string }, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const [existingMovement] = await tx.select({ id: stockMovements.id, inventoryLotId: stockMovements.inventoryLotId }).from(stockMovements).where(eq(stockMovements.idempotencyKey, input.idempotencyKey)).limit(1);
    if (existingMovement) return { inventoryLotId: existingMovement.inventoryLotId, movementId: existingMovement.id, replayed: true };
    const [medication] = await tx.select({ id: medications.id }).from(medications).where(eq(medications.id, input.medicationId)).limit(1);
    if (!medication) throw new Error("MEDICATION_NOT_FOUND");
    const result = await tx.insert(inventoryLots).values({ medicationId: input.medicationId, lotNumber: input.lotNumber.trim(), expiryDate: validateDateOnly(input.expiryDate), receivedQuantity: input.quantity, remainingQuantity: input.quantity, receivedBy: audit.actorUserId }).returning({ id: inventoryLots.id });
    const inventoryLotId = Number(getInsertId(result));
    const movement = await tx.insert(stockMovements).values({ inventoryLotId, movementType: "RECEIVE", quantityDelta: input.quantity, referenceType: "INVENTORY_LOT", referenceId: String(inventoryLotId), idempotencyKey: input.idempotencyKey, performedBy: audit.actorUserId }).returning({ id: stockMovements.id });
    const movementId = Number(getInsertId(movement));
    await tx.insert(auditEvents).values({
      action: "INVENTORY_LOT_RECEIVED", actorUserId: audit.actorUserId, actorRole: audit.actorRole, entityType: "INVENTORY_LOT", entityId: String(inventoryLotId), outcome: "ALLOWED", requestId: audit.requestId,
      metadata: safeAuditMetadata({ medicationId: input.medicationId, quantity: input.quantity }),
    });
    return { inventoryLotId, movementId, replayed: false };
  });
}

export async function listCashierVisits() {
  const db = await requiredDb();
  return db
    .select({
      visitId: visits.id, visitStatus: visits.status, patientId: patients.id, hn: patients.hn, firstName: patients.firstName, lastName: patients.lastName,
      clinicalOrderId: clinicalOrders.id, clinicalOrderStatus: clinicalOrders.status, invoiceId: invoices.id, invoiceNumber: invoices.invoiceNumber, invoiceStatus: invoices.status, totalSatang: invoices.totalSatang,
    })
    .from(visits)
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .leftJoin(clinicalOrders, eq(clinicalOrders.visitId, visits.id))
    .leftJoin(invoices, eq(invoices.visitId, visits.id))
    .where(or(eq(visits.status, "DISPENSING"), eq(visits.status, "BILLED")))
    .orderBy(desc(visits.updatedAt));
}

export async function getCashierVisit(visitId: number) {
  const db = await requiredDb();
  const [visit] = await db
    .select({
      visitId: visits.id,
      visitStatus: visits.status,
      hn: patients.hn,
      firstName: patients.firstName,
      lastName: patients.lastName,
      clinicalOrderId: clinicalOrders.id,
      clinicalOrderStatus: clinicalOrders.status,
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      invoiceStatus: invoices.status,
      subtotalSatang: invoices.subtotalSatang,
      discountSatang: invoices.discountSatang,
      discountReason: invoices.discountReason,
      discountApprovedBy: invoices.discountApprovedBy,
      totalSatang: invoices.totalSatang,
    })
    .from(visits)
    .innerJoin(patients, eq(visits.patientId, patients.id))
    .leftJoin(clinicalOrders, eq(clinicalOrders.visitId, visits.id))
    .leftJoin(invoices, eq(invoices.visitId, visits.id))
    .where(eq(visits.id, visitId))
    .limit(1);
  if (!visit) throw new Error("CASHIER_VISIT_NOT_FOUND");
  const items = visit.clinicalOrderId
    ? await db.select({ id: medicationOrderItems.id, medicationId: medicationOrderItems.medicationId, medicationNameSnapshot: medicationOrderItems.medicationNameSnapshot, dosageFormSnapshot: medicationOrderItems.dosageFormSnapshot, strengthSnapshot: medicationOrderItems.strengthSnapshot, dose: medicationOrderItems.dose, frequency: medicationOrderItems.frequency, duration: medicationOrderItems.duration, quantityPrescribed: medicationOrderItems.quantityPrescribed, instructions: medicationOrderItems.instructions }).from(medicationOrderItems).where(eq(medicationOrderItems.clinicalOrderId, visit.clinicalOrderId))
    : [];
  const invoiceItemRows = visit.invoiceId
    ? await db.select({ id: invoiceLines.id, sourceType: invoiceLines.sourceType, descriptionSnapshot: invoiceLines.descriptionSnapshot, quantity: invoiceLines.quantity, unitPriceSatang: invoiceLines.unitPriceSatang, lineTotalSatang: invoiceLines.lineTotalSatang }).from(invoiceLines).where(eq(invoiceLines.invoiceId, visit.invoiceId))
    : [];
  const charges = await db.select({ id: serviceCharges.id, description: serviceCharges.description, detail: serviceCharges.detail, quantity: serviceCharges.quantity, unitPriceSatang: serviceCharges.unitPriceSatang, status: serviceCharges.status }).from(serviceCharges).where(eq(serviceCharges.visitId, visitId)).orderBy(asc(serviceCharges.id));
  return { ...visit, items, serviceCharges: charges, invoiceLines: invoiceItemRows };
}

export type ServiceChargeInput = {
  visitId: number;
  description: string;
  detail?: string | null;
  quantity: number;
  unitPriceSatang: number;
};

/** Creates an unbilled service item; Cashier remains the only role able to enter financial details. */
export async function addServiceCharge(input: ServiceChargeInput, assistantId: number, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const [visit] = await tx.select({ id: visits.id, status: visits.status }).from(visits).where(eq(visits.id, input.visitId)).limit(1);
    if (!visit) throw new Error("CASHIER_VISIT_NOT_FOUND");
    if (visit.status !== "DISPENSING") throw new Error("VISIT_NOT_READY_FOR_BILLING");
    const result = await tx.insert(serviceCharges).values({
      visitId: input.visitId,
      description: input.description.trim(),
      detail: input.detail?.trim() || null,
      quantity: input.quantity,
      unitPriceSatang: input.unitPriceSatang,
      createdBy: assistantId,
    }).returning({ id: serviceCharges.id });
    const serviceChargeId = Number(getInsertId(result));
    await tx.insert(auditEvents).values({
      action: "SERVICE_CHARGE_ADDED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "SERVICE_CHARGE",
      entityId: String(serviceChargeId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ visitId: input.visitId, quantity: input.quantity, unitPriceSatang: input.unitPriceSatang }),
    });
    return { serviceChargeId, visitId: input.visitId, lineTotalSatang: input.quantity * input.unitPriceSatang, status: "PENDING" as const };
  });
}

export type IssueInvoiceInput = {
  visitId: number;
  idempotencyKey: string;
  discountSatang?: number;
  discountReason?: string | null;
  discountApprovedBy?: number | null;
};

/** Issues the single bill for a signed encounter, with medication and service lines preserved as distinct source types. */
export async function issueVisitInvoice(input: IssueInvoiceInput, assistantId: number, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const [replayed] = await tx.select({ id: invoices.id, visitId: invoices.visitId, invoiceNumber: invoices.invoiceNumber, totalSatang: invoices.totalSatang }).from(invoices).where(eq(invoices.issueRequestId, input.idempotencyKey)).limit(1);
    if (replayed) return { invoiceId: replayed.id, visitId: replayed.visitId, invoiceNumber: replayed.invoiceNumber, totalSatang: replayed.totalSatang, replayed: true };

    const [visit] = await tx.select({ id: visits.id, status: visits.status }).from(visits).where(eq(visits.id, input.visitId)).limit(1);
    if (!visit) throw new Error("CASHIER_VISIT_NOT_FOUND");
    if (visit.status !== "DISPENSING") throw new Error("VISIT_NOT_READY_FOR_BILLING");

    const now = new Date();
    let invoiceId: number;
    let invoiceNumber: string;
    const [existingInvoice] = await tx.select().from(invoices).where(eq(invoices.visitId, input.visitId)).limit(1);
    if (existingInvoice) {
      if (existingInvoice.status !== "DRAFT") throw new Error("INVOICE_NOT_READY_FOR_ISSUING");
      invoiceId = existingInvoice.id;
      invoiceNumber = existingInvoice.invoiceNumber;
    } else {
      invoiceNumber = `INV-${String(input.visitId).padStart(8, "0")}`;
      const created = await tx.insert(invoices).values({ visitId: input.visitId, invoiceNumber, status: "DRAFT", subtotalSatang: 0, discountSatang: 0, totalSatang: 0, issuedBy: assistantId }).returning({ id: invoices.id });
      invoiceId = Number(getInsertId(created));
    }

    const pendingCharges = await tx.select().from(serviceCharges).where(and(eq(serviceCharges.visitId, input.visitId), eq(serviceCharges.status, "PENDING")));
    if (pendingCharges.length) {
      await tx.insert(invoiceLines).values(pendingCharges.map(charge => ({
        invoiceId,
        sourceType: "SERVICE_CHARGE",
        sourceId: String(charge.id),
        descriptionSnapshot: charge.detail ? `${charge.description} · ${charge.detail}` : charge.description,
        quantity: charge.quantity,
        unitPriceSatang: charge.unitPriceSatang,
        lineTotalSatang: charge.quantity * charge.unitPriceSatang,
      })));
      await tx.update(serviceCharges).set({ status: "INVOICED" }).where(and(eq(serviceCharges.visitId, input.visitId), eq(serviceCharges.status, "PENDING")));
    }
    const [lineTotals] = await tx.select({ totalSatang: sql<number>`coalesce(sum(${invoiceLines.lineTotalSatang}), 0)` }).from(invoiceLines).where(eq(invoiceLines.invoiceId, invoiceId));
    const subtotalSatang = Number(lineTotals?.totalSatang ?? 0);
    const discountSatang = Math.min(subtotalSatang, Math.max(0, input.discountSatang ?? 0));
    const totalSatang = subtotalSatang - discountSatang;

    const [lineCountRow] = await tx.select({ count: count(invoiceLines.id) }).from(invoiceLines).where(and(eq(invoiceLines.invoiceId, invoiceId), eq(invoiceLines.sourceType, "MEDICATION_ORDER_ITEM")));
    const medicationLineCount = Math.max(0, lineCountRow?.count ?? 0);

    const updated = await tx.update(invoices).set({
      status: "ISSUED",
      subtotalSatang,
      discountSatang,
      discountReason: input.discountReason?.trim() || null,
      discountApprovedBy: input.discountApprovedBy ?? (discountSatang > 0 ? assistantId : null),
      totalSatang,
      issuedBy: assistantId,
      issuedAt: now,
      issueRequestId: input.idempotencyKey,
    }).where(and(eq(invoices.id, invoiceId), eq(invoices.status, "DRAFT")));

    if (Number(getAffectedRows(updated)) !== 1) throw new Error("INVOICE_NOT_READY_FOR_ISSUING");
    const visitUpdated = await tx.update(visits).set({ status: "BILLED" }).where(and(eq(visits.id, input.visitId), eq(visits.status, "DISPENSING")));
    if (Number(getAffectedRows(visitUpdated)) !== 1) throw new Error("VISIT_NOT_READY_FOR_BILLING");
    await tx.insert(auditEvents).values({
      action: "INVOICE_ISSUED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "INVOICE",
      entityId: String(invoiceId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({ visitId: input.visitId, subtotalSatang, discountSatang, totalSatang, medicationLineCount, serviceLineCount: pendingCharges.length }),
    });
    return { invoiceId, visitId: input.visitId, invoiceNumber, subtotalSatang, discountSatang, totalSatang, replayed: false };
  });
}

export async function dispenseSignedOrder(input: { visitId: number; idempotencyKey: string }, assistantId: number, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const [replayed] = await tx.select({ id: dispensations.id, visitId: dispensations.visitId, status: dispensations.status }).from(dispensations).where(eq(dispensations.requestId, input.idempotencyKey)).limit(1);
    if (replayed) return { dispensationId: replayed.id, visitId: replayed.visitId, status: replayed.status, replayed: true };
    const [visit] = await tx.select({ id: visits.id, status: visits.status }).from(visits).where(eq(visits.id, input.visitId)).limit(1);
    if (!visit) throw new Error("CASHIER_VISIT_NOT_FOUND");
    if (visit.status !== "DISPENSING") throw new Error("VISIT_NOT_READY_FOR_DISPENSING");
    const [order] = await tx.select().from(clinicalOrders).where(and(eq(clinicalOrders.visitId, input.visitId), eq(clinicalOrders.status, "SIGNED"))).limit(1);
    if (!order) throw new Error("SIGNED_MEDICATION_ORDER_NOT_FOUND");
    const items = await tx.select().from(medicationOrderItems).where(eq(medicationOrderItems.clinicalOrderId, order.id));
    if (!items.length) throw new Error("MEDICATION_ORDER_EMPTY");
    const now = new Date();
    const allocation = await Promise.all(items.map(async item => {
      const [lot] = await tx.select().from(inventoryLots).where(and(eq(inventoryLots.medicationId, item.medicationId), gte(inventoryLots.remainingQuantity, item.quantityPrescribed), gt(inventoryLots.expiryDate, now.toISOString().slice(0, 10)))).orderBy(asc(inventoryLots.expiryDate)).limit(1);
      if (!lot) throw new Error("INSUFFICIENT_STOCK");
      const [price] = await tx.select().from(medicationPrices).where(and(eq(medicationPrices.medicationId, item.medicationId), eq(medicationPrices.isActive, true))).orderBy(desc(medicationPrices.effectiveFrom)).limit(1);
      if (!price) throw new Error("ACTIVE_MEDICATION_PRICE_NOT_FOUND");
      return { item, lot, price };
    }));
    const dispenseResult = await tx.insert(dispensations).values({ visitId: input.visitId, clinicalOrderId: order.id, status: "PENDING", requestId: input.idempotencyKey }).returning({ id: dispensations.id });
    const dispensationId = Number(getInsertId(dispenseResult));
    for (const allocationItem of allocation) {
      const updateLot = await tx.update(inventoryLots).set({ remainingQuantity: allocationItem.lot.remainingQuantity - allocationItem.item.quantityPrescribed }).where(and(eq(inventoryLots.id, allocationItem.lot.id), gte(inventoryLots.remainingQuantity, allocationItem.item.quantityPrescribed)));
      if (Number(getAffectedRows(updateLot)) !== 1) throw new Error("INSUFFICIENT_STOCK");
    }
    await tx.insert(dispensationItems).values(allocation.map(({ item, lot }) => ({ dispensationId, medicationOrderItemId: item.id, inventoryLotId: lot.id, quantityDispensed: item.quantityPrescribed })));
    await tx.insert(stockMovements).values(allocation.map(({ item, lot }, index) => ({ inventoryLotId: lot.id, movementType: "DISPENSE" as const, quantityDelta: -item.quantityPrescribed, referenceType: "DISPENSATION", referenceId: String(dispensationId), idempotencyKey: `${input.idempotencyKey}:${index}`, performedBy: assistantId })));
    const totalSatang = allocation.reduce((sum, entry) => sum + entry.item.quantityPrescribed * entry.price.unitPriceSatang, 0);
    const invoiceResult = await tx.insert(invoices).values({ visitId: input.visitId, invoiceNumber: `INV-${String(input.visitId).padStart(8, "0")}`, status: "DRAFT", subtotalSatang: totalSatang, discountSatang: 0, totalSatang, issuedBy: assistantId }).returning({ id: invoices.id });
    const invoiceId = Number(getInsertId(invoiceResult));
    await tx.insert(invoiceLines).values(allocation.map(({ item, price }) => ({ invoiceId, sourceType: "MEDICATION_ORDER_ITEM", sourceId: String(item.id), descriptionSnapshot: `${item.medicationNameSnapshot} ${item.strengthSnapshot}`, quantity: item.quantityPrescribed, unitPriceSatang: price.unitPriceSatang, lineTotalSatang: item.quantityPrescribed * price.unitPriceSatang })));
    await tx.update(dispensations).set({ status: "COMPLETED", dispensedBy: assistantId, completedAt: now }).where(eq(dispensations.id, dispensationId));
    await tx.insert(auditEvents).values([
      { action: "MEDICATION_DISPENSED", actorUserId: audit.actorUserId, actorRole: audit.actorRole, entityType: "DISPENSATION", entityId: String(dispensationId), outcome: "ALLOWED", requestId: audit.requestId, metadata: safeAuditMetadata({ visitId: input.visitId, itemCount: items.length }) },
      { action: "MEDICATION_BILL_LINES_PREPARED", actorUserId: audit.actorUserId, actorRole: audit.actorRole, entityType: "INVOICE", entityId: String(invoiceId), outcome: "ALLOWED", requestId: audit.requestId, metadata: safeAuditMetadata({ visitId: input.visitId, totalSatang }) },
    ]);
    return { dispensationId, invoiceId, invoiceNumber: `INV-${String(input.visitId).padStart(8, "0")}`, totalSatang, status: "COMPLETED" as const, replayed: false };
  });
}

export type ReceivePaymentInput = {
  invoiceId: number;
  paymentMethod: "CASH" | "PROMPTPAY" | "EXTERNAL_REFERENCE" | "CREDIT_CARD";
  amountSatang: number;
  externalReference?: string | null;
  idempotencyKey: string;
};

export async function receiveInvoicePayment(input: ReceivePaymentInput, assistantId: number, audit: AuditContext) {
  const db = await requiredDb();
  return db.transaction(async tx => {
    const [replayed] = await tx.select().from(payments).where(eq(payments.idempotencyKey, input.idempotencyKey)).limit(1);
    if (replayed) return { paymentId: replayed.id, invoiceId: replayed.invoiceId, replayed: true };
    const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, input.invoiceId)).limit(1);
    if (!invoice) throw new Error("INVOICE_NOT_FOUND");
    if (invoice.status !== "ISSUED") throw new Error("INVOICE_NOT_READY_FOR_PAYMENT");
    if (invoice.totalSatang !== input.amountSatang) throw new Error("PAYMENT_AMOUNT_MISMATCH");
    if ((input.paymentMethod === "EXTERNAL_REFERENCE" || input.paymentMethod === "CREDIT_CARD") && !input.externalReference?.trim()) {
      throw new Error("EXTERNAL_REFERENCE_REQUIRED");
    }
    const now = new Date();
    const result = await tx.insert(payments).values({
      invoiceId: input.invoiceId,
      paymentMethod: input.paymentMethod,
      amountSatang: input.amountSatang,
      externalReference: input.externalReference?.trim() || null,
      idempotencyKey: input.idempotencyKey,
      receivedBy: assistantId,
      receivedAt: now,
    }).returning({ id: payments.id });
    const paymentId = Number(getInsertId(result));
    const invoiceUpdate = await tx.update(invoices).set({ status: "PAID", paidAt: now }).where(and(eq(invoices.id, input.invoiceId), eq(invoices.status, "ISSUED")));
    if (Number(getAffectedRows(invoiceUpdate)) !== 1) throw new Error("INVOICE_NOT_READY_FOR_PAYMENT");
    const closedVisit = await tx.update(visits).set({ status: "CLOSED" }).where(and(eq(visits.id, invoice.visitId), eq(visits.status, "BILLED")));
    if (Number(getAffectedRows(closedVisit)) !== 1) throw new Error("VISIT_NOT_READY_FOR_CLOSURE");
    await tx.insert(auditEvents).values([
      { action: "INVOICE_PAID", actorUserId: audit.actorUserId, actorRole: audit.actorRole, entityType: "PAYMENT", entityId: String(paymentId), outcome: "ALLOWED", requestId: audit.requestId, metadata: safeAuditMetadata({ invoiceId: input.invoiceId, amountSatang: input.amountSatang, paymentMethod: input.paymentMethod }) },
      { action: "VISIT_CLOSED_AFTER_PAYMENT", actorUserId: audit.actorUserId, actorRole: audit.actorRole, entityType: "VISIT", entityId: String(invoice.visitId), outcome: "ALLOWED", requestId: audit.requestId, metadata: safeAuditMetadata({ invoiceId: input.invoiceId }) },
    ]);
    return { paymentId, invoiceId: input.invoiceId, paidAt: now, replayed: false };
  });
}

export async function getDailyCashierSummary(dateStrInput: string) {
  const db = await requiredDb();
  const dateStr = validateDateOnly(dateStrInput);
  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

  const paymentRows = await db
    .select({
      id: payments.id,
      paymentMethod: payments.paymentMethod,
      amountSatang: payments.amountSatang,
      receivedAt: payments.receivedAt,
    })
    .from(payments)
    .where(and(gte(payments.receivedAt, startOfDay), lte(payments.receivedAt, endOfDay)));

  let totalCashExpectedSatang = 0;
  let totalPromptPaySatang = 0;
  let totalOtherSatang = 0;

  for (const p of paymentRows) {
    if (p.paymentMethod === "CASH") {
      totalCashExpectedSatang += p.amountSatang;
    } else if (p.paymentMethod === "PROMPTPAY") {
      totalPromptPaySatang += p.amountSatang;
    } else {
      totalOtherSatang += p.amountSatang;
    }
  }

  const totalRevenueSatang = totalCashExpectedSatang + totalPromptPaySatang + totalOtherSatang;
  const paidInvoicesCount = paymentRows.length;

  const [unpaidSummary] = await db
    .select({
      unpaidCount: count(invoices.id),
      unpaidSatang: sql<number>`coalesce(sum(${invoices.totalSatang}), 0)`,
    })
    .from(invoices)
    .where(eq(invoices.status, "ISSUED"));

  const [existingCloseout] = await db
    .select()
    .from(dailyCloseouts)
    .where(eq(dailyCloseouts.closeoutDate, dateStr))
    .limit(1);

  return {
    date: dateStr,
    totalCashExpectedSatang,
    totalPromptPaySatang,
    totalOtherSatang,
    totalRevenueSatang,
    paidInvoicesCount,
    unpaidInvoicesCount: Number(unpaidSummary?.unpaidCount ?? 0),
    unpaidInvoicesSatang: Number(unpaidSummary?.unpaidSatang ?? 0),
    closeout: existingCloseout ?? null,
  };
}

export type SubmitDailyCloseoutInput = {
  closeoutDate: string;
  totalCashCountedSatang: number;
  notes?: string | null;
};

export async function submitDailyCloseout(input: SubmitDailyCloseoutInput, userId: number, audit: AuditContext) {
  const db = await requiredDb();
  const summary = await getDailyCashierSummary(input.closeoutDate);
  const cashDifferenceSatang = input.totalCashCountedSatang - summary.totalCashExpectedSatang;

  return db.transaction(async tx => {
    const [existing] = await tx.select({ id: dailyCloseouts.id }).from(dailyCloseouts).where(eq(dailyCloseouts.closeoutDate, summary.date)).limit(1);
    let closeoutId: number;
    const values = {
      closeoutDate: summary.date,
      closedBy: userId,
      totalCashExpectedSatang: summary.totalCashExpectedSatang,
      totalCashCountedSatang: input.totalCashCountedSatang,
      cashDifferenceSatang,
      totalPromptPaySatang: summary.totalPromptPaySatang,
      totalOtherSatang: summary.totalOtherSatang,
      totalRevenueSatang: summary.totalRevenueSatang,
      totalInvoicesCount: summary.paidInvoicesCount,
      notes: input.notes?.trim() || null,
      closedAt: new Date(),
    };

    if (existing) {
      await tx.update(dailyCloseouts).set(values).where(eq(dailyCloseouts.id, existing.id));
      closeoutId = existing.id;
    } else {
      const result = await tx.insert(dailyCloseouts).values(values).returning({ id: dailyCloseouts.id });
      closeoutId = Number(getInsertId(result));
    }

    await tx.insert(auditEvents).values({
      action: "DAILY_CLOSEOUT_RECORDED",
      actorUserId: audit.actorUserId,
      actorRole: audit.actorRole,
      entityType: "DAILY_CLOSEOUT",
      entityId: String(closeoutId),
      outcome: "ALLOWED",
      requestId: audit.requestId,
      metadata: safeAuditMetadata({
        closeoutDate: summary.date,
        totalCashExpectedSatang: summary.totalCashExpectedSatang,
        totalCashCountedSatang: input.totalCashCountedSatang,
        cashDifferenceSatang,
        totalRevenueSatang: summary.totalRevenueSatang,
      }),
    });

    const [saved] = await tx.select().from(dailyCloseouts).where(eq(dailyCloseouts.id, closeoutId)).limit(1);
    return saved!;
  });
}

export type AggregateReportRange = { from: string; to: string };

function startOfUtcDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function dayAfterUtc(value: string) {
  const end = startOfUtcDate(value);
  end.setUTCDate(end.getUTCDate() + 1);
  return end;
}

/**
 * Returns operational aggregates only. This helper intentionally never joins
 * patients, clinical notes, diagnoses, user identities, invoice numbers or lot
 * numbers so the report contract remains safe for SYSTEM_ADMIN.
 */
export async function getAggregateOperationsReport(range: AggregateReportRange) {
  const db = await requiredDb();
  const reportStart = startOfUtcDate(range.from);
  const reportEndExclusive = dayAfterUtc(range.to);
  const expiryThreshold = new Date(reportStart);
  expiryThreshold.setUTCDate(expiryThreshold.getUTCDate() + 30);
  const expiryThresholdDate = expiryThreshold.toISOString().slice(0, 10);

  const [visitSummary] = await db
    .select({ visitCount: count(visits.id) })
    .from(visits)
    .where(and(gte(visits.visitDate, range.from), lte(visits.visitDate, range.to)));

  const [paymentSummary] = await db
    .select({
      paymentCount: count(payments.id),
      paidSatang: sql<number>`coalesce(sum(${payments.amountSatang}), 0)`,
    })
    .from(payments)
    .where(and(gte(payments.receivedAt, reportStart), lt(payments.receivedAt, reportEndExclusive)));

  const paymentBreakdownRows = await db
    .select({
      paymentMethod: payments.paymentMethod,
      totalSatang: sql<number>`coalesce(sum(${payments.amountSatang}), 0)`,
    })
    .from(payments)
    .where(and(gte(payments.receivedAt, reportStart), lt(payments.receivedAt, reportEndExclusive)))
    .groupBy(payments.paymentMethod);

  let cashSatang = 0;
  let promptPaySatang = 0;
  let otherSatang = 0;
  for (const row of paymentBreakdownRows) {
    if (row.paymentMethod === "CASH") cashSatang = Number(row.totalSatang ?? 0);
    else if (row.paymentMethod === "PROMPTPAY") promptPaySatang = Number(row.totalSatang ?? 0);
    else otherSatang += Number(row.totalSatang ?? 0);
  }

  const [unpaidInvoicesSummary] = await db
    .select({
      unpaidCount: count(invoices.id),
      unpaidSatang: sql<number>`coalesce(sum(${invoices.totalSatang}), 0)`,
    })
    .from(invoices)
    .where(eq(invoices.status, "ISSUED"));

  const [dispenseSummary] = await db
    .select({ dispensedUnits: sql<number>`coalesce(sum(abs(${stockMovements.quantityDelta})), 0)` })
    .from(stockMovements)
    .where(and(eq(stockMovements.movementType, "DISPENSE"), gte(stockMovements.createdAt, reportStart), lt(stockMovements.createdAt, reportEndExclusive)));

  const [stockSummary] = await db
    .select({
      activeLotCount: count(inventoryLots.id),
      onHandUnits: sql<number>`coalesce(sum(${inventoryLots.remainingQuantity}), 0)`,
      expiringLotCount: sql<number>`coalesce(sum(case when ${inventoryLots.expiryDate} <= ${expiryThresholdDate} then 1 else 0 end), 0)`,
    })
    .from(inventoryLots)
    .where(gt(inventoryLots.remainingQuantity, 0));

  const allActiveMeds = await db
    .select({ id: medications.id, minStockThreshold: medications.minStockThreshold })
    .from(medications)
    .where(eq(medications.isActive, true));

  const allLots = await db
    .select({ medicationId: inventoryLots.medicationId, remainingQuantity: sql<number>`coalesce(sum(${inventoryLots.remainingQuantity}), 0)` })
    .from(inventoryLots)
    .groupBy(inventoryLots.medicationId);

  const lotMap = new Map(allLots.map(l => [l.medicationId, Number(l.remainingQuantity ?? 0)]));
  let lowStockMedicationsCount = 0;
  for (const m of allActiveMeds) {
    const onHand = lotMap.get(m.id) ?? 0;
    if (onHand <= m.minStockThreshold) lowStockMedicationsCount++;
  }

  const dailyVisitRows = await db
    .select({ day: visits.visitDate, visitCount: count(visits.id) })
    .from(visits)
    .where(and(gte(visits.visitDate, range.from), lte(visits.visitDate, range.to)))
    .groupBy(visits.visitDate)
    .orderBy(asc(visits.visitDate));

  const dailyRevenueRows = await db
    .select({ receivedAt: payments.receivedAt, amountSatang: payments.amountSatang })
    .from(payments)
    .where(and(gte(payments.receivedAt, reportStart), lt(payments.receivedAt, reportEndExclusive)));

  const dispensedUnits = sql<number>`coalesce(sum(abs(${stockMovements.quantityDelta})), 0)`;
  const topMedicationRows = await db
    .select({
      medicationId: medications.id,
      genericName: medications.genericName,
      dosageForm: medications.dosageForm,
      strength: medications.strength,
      dispensedUnits,
    })
    .from(stockMovements)
    .innerJoin(inventoryLots, eq(stockMovements.inventoryLotId, inventoryLots.id))
    .innerJoin(medications, eq(inventoryLots.medicationId, medications.id))
    .where(and(eq(stockMovements.movementType, "DISPENSE"), gte(stockMovements.createdAt, reportStart), lt(stockMovements.createdAt, reportEndExclusive)))
    .groupBy(medications.id, medications.genericName, medications.dosageForm, medications.strength)
    .orderBy(desc(dispensedUnits))
    .limit(10);

  const revenueByDay = summarizePaymentsByClinicDay(dailyRevenueRows);
  const visitsByDay = new Map(dailyVisitRows.map(row => [row.day, Number(row.visitCount ?? 0)]));
  const days = Array.from(new Set(Array.from(visitsByDay.keys()).concat(Array.from(revenueByDay.keys())))).sort();

  return {
    range,
    generatedAt: new Date(),
    summary: {
      visitCount: Number(visitSummary?.visitCount ?? 0),
      paymentCount: Number(paymentSummary?.paymentCount ?? 0),
      paidSatang: Number(paymentSummary?.paidSatang ?? 0),
      paymentMethodBreakdown: {
        cashSatang,
        promptPaySatang,
        otherSatang,
      },
      unpaidInvoices: {
        count: Number(unpaidInvoicesSummary?.unpaidCount ?? 0),
        totalSatang: Number(unpaidInvoicesSummary?.unpaidSatang ?? 0),
      },
      dispensedUnits: Number(dispenseSummary?.dispensedUnits ?? 0),
      activeLotCount: Number(stockSummary?.activeLotCount ?? 0),
      onHandUnits: Number(stockSummary?.onHandUnits ?? 0),
      expiringLotCount: Number(stockSummary?.expiringLotCount ?? 0),
      lowStockMedicationsCount,
    },
    daily: days.map(day => ({ day, visitCount: visitsByDay.get(day) ?? 0, paidSatang: revenueByDay.get(day) ?? 0 })),
    topMedications: topMedicationRows.map(row => ({
      medicationId: row.medicationId,
      genericName: row.genericName,
      dosageForm: row.dosageForm,
      strength: row.strength,
      dispensedUnits: Number(row.dispensedUnits ?? 0),
    })),
  };
}

/**
 * Returns past visits, triage records, clinical notes, diagnoses, and signed medication orders
 * for a specific patient. Access is strictly limited to authorized doctors during consultation.
 */
export async function getPatientClinicalHistory(patientId: number) {
  const db = await requiredDb();
  const patient = await db
    .select({
      id: patients.id,
      hn: patients.hn,
      firstName: patients.firstName,
      lastName: patients.lastName,
      dateOfBirth: patients.dateOfBirth,
      gender: patients.gender,
      allergySummary: patients.allergySummary,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patient[0]) throw new Error("PATIENT_NOT_FOUND");

  const patientVisits = await db
    .select({
      id: visits.id,
      visitDate: visits.visitDate,
      chiefComplaint: visits.chiefComplaint,
      status: visits.status,
      createdAt: visits.createdAt,
    })
    .from(visits)
    .where(eq(visits.patientId, patientId))
    .orderBy(desc(visits.visitDate), desc(visits.createdAt))
    .limit(25);

  const history = await Promise.all(
    patientVisits.map(async v => {
      const [triage] = await db.select().from(triageRecords).where(eq(triageRecords.visitId, v.id)).limit(1);
      const [note] = await db.select().from(clinicalNotes).where(eq(clinicalNotes.visitId, v.id)).limit(1);
      const diagnoses = await db
        .select({ id: visitDiagnoses.id, code: visitDiagnoses.code, display: visitDiagnoses.display, rank: visitDiagnoses.rank })
        .from(visitDiagnoses)
        .where(eq(visitDiagnoses.visitId, v.id))
        .orderBy(asc(visitDiagnoses.rank));

      const orders = await db
        .select({
          medicationNameSnapshot: medicationOrderItems.medicationNameSnapshot,
          dosageFormSnapshot: medicationOrderItems.dosageFormSnapshot,
          strengthSnapshot: medicationOrderItems.strengthSnapshot,
          dose: medicationOrderItems.dose,
          frequency: medicationOrderItems.frequency,
          duration: medicationOrderItems.duration,
          quantityPrescribed: medicationOrderItems.quantityPrescribed,
          instructions: medicationOrderItems.instructions,
        })
        .from(clinicalOrders)
        .innerJoin(medicationOrderItems, eq(medicationOrderItems.clinicalOrderId, clinicalOrders.id))
        .where(and(eq(clinicalOrders.visitId, v.id), eq(clinicalOrders.status, "SIGNED")));

      return {
        visitId: v.id,
        visitDate: v.visitDate,
        chiefComplaint: v.chiefComplaint,
        status: v.status,
        createdAt: v.createdAt,
        triage: triage
          ? {
              bloodPressureSystolic: triage.bloodPressureSystolic,
              bloodPressureDiastolic: triage.bloodPressureDiastolic,
              pulse: triage.pulse,
              temperatureCelsius: triage.temperatureCelsius,
              oxygenSaturation: triage.oxygenSaturation,
              weightKg: triage.weightKg,
              heightCm: triage.heightCm,
              triageNote: triage.triageNote,
              urgency: triage.urgency,
            }
          : null,
        clinicalNote: note
          ? {
              subjective: note.subjective,
              objective: note.objective,
              assessment: note.assessment,
              plan: note.plan,
              status: note.status,
              signedAt: note.signedAt,
            }
          : null,
        diagnoses,
        prescriptions: orders,
      };
    })
  );

  return {
    patient: patient[0],
    visits: history,
  };
}

export type AuditLogFilter = {
  limit?: number;
  offset?: number;
  action?: string | null;
  actorRole?: "SYSTEM_ADMIN" | "DOCTOR" | "ASSISTANT" | null;
  outcome?: "ALLOWED" | "DENIED" | "FAILED" | null;
  startDate?: string | null;
  endDate?: string | null;
};

/**
 * Returns security audit logs for SYSTEM_ADMIN review.
 * Strictly returns only audit metadata and actor username/role, never PHI or patient identity.
 */
export async function listAuditLogs(input: AuditLogFilter) {
  const db = await requiredDb();
  const limit = Math.min(input.limit ?? 50, 100);
  const offset = input.offset ?? 0;

  const conditions = [];
  if (input.action && input.action.trim()) {
    conditions.push(like(auditEvents.action, `%${input.action.trim()}%`));
  }
  if (input.actorRole) {
    conditions.push(eq(auditEvents.actorRole, input.actorRole));
  }
  if (input.outcome) {
    conditions.push(eq(auditEvents.outcome, input.outcome));
  }
  if (input.startDate && /^\d{4}-\d{2}-\d{2}$/.test(input.startDate)) {
    conditions.push(gte(auditEvents.occurredAt, new Date(`${input.startDate}T00:00:00.000Z`)));
  }
  if (input.endDate && /^\d{4}-\d{2}-\d{2}$/.test(input.endDate)) {
    conditions.push(lte(auditEvents.occurredAt, new Date(`${input.endDate}T23:59:59.999Z`)));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const totalCountResult = await db
    .select({ count: count() })
    .from(auditEvents)
    .where(whereClause);
  const totalCount = Number(totalCountResult[0]?.count ?? 0);

  const rows = await db
    .select({
      id: auditEvents.id,
      action: auditEvents.action,
      actorUserId: auditEvents.actorUserId,
      actorRole: auditEvents.actorRole,
      actorDisplayName: users.displayName,
      actorUsername: users.username,
      entityType: auditEvents.entityType,
      entityId: auditEvents.entityId,
      outcome: auditEvents.outcome,
      requestId: auditEvents.requestId,
      metadata: auditEvents.metadata,
      occurredAt: auditEvents.occurredAt,
    })
    .from(auditEvents)
    .leftJoin(users, eq(auditEvents.actorUserId, users.id))
    .where(whereClause)
    .orderBy(desc(auditEvents.occurredAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows,
    totalCount,
    limit,
    offset,
  };
}

/** Record an explicit audit trail event when reports CSV is exported. */
export async function recordReportExportAudit(audit: AuditContext, reportType: string, dateRange: { from: string; to: string }) {
  const db = await requiredDb();
  await db.insert(auditEvents).values({
    action: "REPORT_EXPORTED_CSV",
    actorUserId: audit.actorUserId,
    actorRole: audit.actorRole,
    entityType: "REPORT",
    entityId: reportType,
    outcome: "ALLOWED",
    requestId: audit.requestId,
    metadata: safeAuditMetadata({
      reportType,
      from: dateRange.from,
      to: dateRange.to,
    }),
  });
}
