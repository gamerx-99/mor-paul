import { beforeEach, describe, expect, it, vi } from "vitest";
import { isValidThaiNationalId, maskThaiNationalId, normalizeThaiNationalId } from "../shared/nationalId";
import { isValidPassportNumber, maskPassportNumber, normalizePassportNumber } from "../shared/identityDocument";

const drizzleFactory = vi.hoisted(() => vi.fn());

vi.mock("drizzle-orm/postgres-js", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm/postgres-js")>("drizzle-orm/postgres-js");
  return { ...actual, drizzle: drizzleFactory };
});

import { createPatient, recordPatientNationalId } from "./db";

const selectResults: unknown[][] = [];
const updateCalls: Array<Record<string, unknown>> = [];
const auditEvents: Array<Record<string, unknown>> = [];
let affectedRows = 1;

function queryFor(result: unknown[]) {
  const query: {
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    then: PromiseLike<unknown[]>["then"];
  } = {
    where: vi.fn(),
    limit: vi.fn(),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  query.where.mockReturnValue(query);
  query.limit.mockResolvedValue(result);
  return query;
}

const tx = {
  select: vi.fn(() => ({ from: vi.fn(() => queryFor(selectResults.shift() ?? [])) })),
  update: vi.fn(() => ({ set: vi.fn((values: Record<string, unknown>) => ({ where: vi.fn(async () => {
    updateCalls.push(values);
    return [{ affectedRows }];
  }) })) })),
  insert: vi.fn(() => ({
    values: vi.fn((values: Record<string, unknown>) => {
      auditEvents.push(values);
      const rows = [{ id: 1, insertId: 1 }];
      return {
        returning: vi.fn(async () => rows),
        then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
      };
    }),
  })),
};

const db = { transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)) };
const audit = { actorUserId: 12, actorRole: "ASSISTANT" as const, requestId: "national-id-request" };

describe("national ID write-once workflow", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://national-id-test";
    process.env.NATIONAL_ID_ENCRYPTION_KEY = "test-identity-document-encryption-key-at-least-32-chars";
    drizzleFactory.mockReturnValue(db);
    selectResults.splice(0);
    updateCalls.splice(0);
    auditEvents.splice(0);
    affectedRows = 1;
    vi.clearAllMocks();
    drizzleFactory.mockReturnValue(db);
  });

  it("validates Thai national-ID checksum and applies the 2+3 masked display format", () => {
    expect(normalizeThaiNationalId("1-1007-00200-10-7")).toBe("1100700200107");
    expect(isValidThaiNationalId("1-1007-00200-10-7")).toBe(true);
    expect(isValidThaiNationalId("1100700200108")).toBe(false);
    expect(maskThaiNationalId("1100700200107")).toBe("11••••••••107");
  });

  it("normalizes, validates, and masks Passport values without retaining separators", () => {
    expect(normalizePassportNumber(" ab-123 456 ")).toBe("AB123456");
    expect(isValidPassportNumber(" ab-123 456 ")).toBe(true);
    expect(isValidPassportNumber("ABCDEF")).toBe(false);
    expect(maskPassportNumber(" ab-123 456 ")).toBe("AB••••56");
  });

  it("creates a Passport-backed HN with ciphertext/hash only and a PHI-safe audit event", async () => {
    selectResults.push([{ id: 1, hn: "HN00000001", firstName: "Policy", lastName: "Test", dateOfBirth: "1990-01-01", gender: "UNSPECIFIED", phone: null, address: null, allergySummary: null, idDocumentType: "PASSPORT", createdBy: 12, createdAt: new Date(), updatedAt: new Date() }]);

    const result = await createPatient({ firstName: "Policy", lastName: "Test", dateOfBirth: "1990-01-01", gender: "UNSPECIFIED", idDocumentType: "PASSPORT", idDocumentNumber: " ab-123 456 ", consentAccepted: true }, audit);

    expect(result).toMatchObject({ hn: "HN00000001", idDocumentType: "PASSPORT", identityDocumentMasked: "AB••••56" });
    const persistedPatient = auditEvents.find(values => "passportCiphertext" in values);
    const registrationAudit = auditEvents.find(values => values.action === "PATIENT_REGISTERED");
    expect(persistedPatient).toEqual(expect.objectContaining({ passportCiphertext: expect.any(String), passportLookupHash: expect.any(String), nationalIdCiphertext: null }));
    expect(JSON.stringify(persistedPatient)).not.toContain("AB123456");
    expect(registrationAudit).toEqual(expect.objectContaining({ metadata: expect.stringContaining("PASSPORT") }));
    expect(JSON.stringify(registrationAudit)).not.toContain("AB123456");
  });

  it("encrypts and records a national ID once, returning only its masked value", async () => {
    selectResults.push([{ id: 7, idDocumentType: null, nationalIdCiphertext: null }]);

    const result = await recordPatientNationalId({ patientId: 7, nationalId: "1100700200107", source: "ASSISTANT_ENTRY" }, audit);

    expect(result).toEqual({ isSet: true, nationalIdMasked: "11••••••••107" });
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0]).toEqual(expect.objectContaining({
      nationalIdCiphertext: expect.any(String),
      nationalIdLookupHash: expect.any(String),
      nationalIdSetBy: 12,
    }));
    expect(JSON.stringify(updateCalls)).not.toContain("1100700200107");
    expect(auditEvents[0]).toEqual(expect.objectContaining({ action: "PATIENT_NATIONAL_ID_RECORDED" }));
    expect(JSON.stringify(auditEvents)).not.toContain("1100700200107");
  });

  it("refuses a second write before issuing an update or audit event", async () => {
    selectResults.push([{ id: 7, idDocumentType: "THAI_NATIONAL_ID", nationalIdCiphertext: "already-encrypted" }]);

    await expect(recordPatientNationalId({ patientId: 7, nationalId: "1100700200107", source: "ASSISTANT_ENTRY" }, audit)).rejects.toThrow("NATIONAL_ID_WRITE_ONCE");
    expect(updateCalls).toHaveLength(0);
    expect(auditEvents).toHaveLength(0);
  });

  it("does not emit an allowed audit event when a concurrent identity write wins the conditional update", async () => {
    selectResults.push([{ id: 7, idDocumentType: null, nationalIdCiphertext: null }]);
    affectedRows = 0;

    await expect(recordPatientNationalId({ patientId: 7, nationalId: "1100700200107", source: "ASSISTANT_ENTRY" }, audit)).rejects.toThrow("NATIONAL_ID_WRITE_ONCE");
    expect(updateCalls).toHaveLength(1);
    expect(auditEvents).toHaveLength(0);
  });
});
