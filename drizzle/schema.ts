import { boolean, date, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Local clinic accounts are deliberately separate from Manus OAuth. Passwords
 * are never stored here; only a slow, salted password hash is persisted.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  displayName: varchar("displayName", { length: 120 }).notNull(),
  role: mysqlEnum("role", ["SYSTEM_ADMIN", "DOCTOR", "ASSISTANT"]).default("ASSISTANT").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
  failedLoginCount: int("failedLoginCount").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Opaque sessions keep raw bearer tokens out of the database and allow logout/revocation. */
export const userSessions = mysqlTable("userSessions", {
  id: int("id").autoincrement().primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  userId: int("userId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Identifying and contact data is kept in the patient record only. It is never
 * copied to audit events and is available exclusively through PHI procedures.
 */
export const patients = mysqlTable("patients", {
  id: int("id").autoincrement().primaryKey(),
  hn: varchar("hn", { length: 24 }).notNull().unique(),
  firstName: varchar("firstName", { length: 120 }).notNull(),
  lastName: varchar("lastName", { length: 120 }).notNull(),
  dateOfBirth: date("dateOfBirth", { mode: "string" }).notNull(),
  gender: mysqlEnum("gender", ["MALE", "FEMALE", "OTHER", "UNSPECIFIED"]).default("UNSPECIFIED").notNull(),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  allergySummary: varchar("allergySummary", { length: 1000 }),
  /** Ciphertext and keyed lookup are deliberately never selected by client-facing patient queries. */
  nationalIdCiphertext: varchar("nationalIdCiphertext", { length: 512 }),
  nationalIdLookupHash: varchar("nationalIdLookupHash", { length: 64 }),
  nationalIdSetAt: timestamp("nationalIdSetAt"),
  nationalIdSetBy: int("nationalIdSetBy"),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("patients_name_idx").on(table.lastName, table.firstName), uniqueIndex("patients_national_id_hash_unique").on(table.nationalIdLookupHash)]);

export const visits = mysqlTable("visits", {
  id: int("id").autoincrement().primaryKey(),
  patientId: int("patientId").notNull(),
  visitDate: date("visitDate", { mode: "string" }).notNull(),
  chiefComplaint: varchar("chiefComplaint", { length: 2000 }).notNull(),
  status: mysqlEnum("status", ["REGISTERED", "TRIAGED", "WAITING_DOCTOR", "IN_CONSULT", "DISPENSING", "BILLED", "CLOSED", "CANCELLED"]).default("REGISTERED").notNull(),
  version: int("version").default(1).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("visits_patient_idx").on(table.patientId), index("visits_date_status_idx").on(table.visitDate, table.status)]);

export const triageRecords = mysqlTable("triageRecords", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().unique(),
  bloodPressureSystolic: int("bloodPressureSystolic"),
  bloodPressureDiastolic: int("bloodPressureDiastolic"),
  pulse: int("pulse"),
  temperatureCelsius: decimal("temperatureCelsius", { precision: 4, scale: 1 }),
  oxygenSaturation: int("oxygenSaturation"),
  weightKg: decimal("weightKg", { precision: 5, scale: 2 }),
  heightCm: decimal("heightCm", { precision: 5, scale: 2 }),
  triageNote: varchar("triageNote", { length: 2000 }),
  urgency: mysqlEnum("urgency", ["ROUTINE", "PRIORITY", "URGENT"]).default("ROUTINE").notNull(),
  performedBy: int("performedBy").notNull(),
  performedAt: timestamp("performedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("triage_performed_at_idx").on(table.performedAt)]);

export const queueEntries = mysqlTable("queueEntries", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().unique(),
  queueDate: date("queueDate", { mode: "string" }).notNull(),
  queueNumber: int("queueNumber").notNull(),
  status: mysqlEnum("status", ["WAITING", "CALLED", "IN_CONSULT", "COMPLETED", "CANCELLED"]).default("WAITING").notNull(),
  assignedTo: int("assignedTo"),
  calledAt: timestamp("calledAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("queue_date_number_unique").on(table.queueDate, table.queueNumber), index("queue_date_status_idx").on(table.queueDate, table.status)]);

/** One editable clinical draft per visit. Signing locks the original clinical narrative. */
export const clinicalNotes = mysqlTable("clinicalNotes", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().unique(),
  subjective: text("subjective"),
  objective: text("objective"),
  assessment: text("assessment"),
  plan: text("plan"),
  status: mysqlEnum("status", ["DRAFT", "SIGNED"]).default("DRAFT").notNull(),
  revision: int("revision").default(1).notNull(),
  authoredBy: int("authoredBy").notNull(),
  signedAt: timestamp("signedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("clinical_notes_author_status_idx").on(table.authoredBy, table.status)]);

/** Diagnosis entries are written by the clinician at signing time; no diagnosis catalogue is seeded. */
export const visitDiagnoses = mysqlTable("visitDiagnoses", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull(),
  code: varchar("code", { length: 32 }),
  display: varchar("display", { length: 1000 }).notNull(),
  rank: int("rank").notNull(),
  enteredBy: int("enteredBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("visit_diagnoses_rank_unique").on(table.visitId, table.rank), index("visit_diagnoses_visit_idx").on(table.visitId)]);

/** Medicine master data begins empty and contains no patient or prescription information. */
export const medications = mysqlTable("medications", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  genericName: varchar("genericName", { length: 255 }).notNull(),
  tradeName: varchar("tradeName", { length: 255 }),
  dosageForm: varchar("dosageForm", { length: 120 }).notNull(),
  strength: varchar("strength", { length: 120 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("medications_active_name_idx").on(table.isActive, table.genericName)]);

/** Prices are versioned; invoices snapshot the charged price and never reread this table. */
export const medicationPrices = mysqlTable("medicationPrices", {
  id: int("id").autoincrement().primaryKey(),
  medicationId: int("medicationId").notNull(),
  unitPriceSatang: int("unitPriceSatang").notNull(),
  effectiveFrom: timestamp("effectiveFrom").defaultNow().notNull(),
  effectiveTo: timestamp("effectiveTo"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("medication_prices_lookup_idx").on(table.medicationId, table.isActive, table.effectiveFrom)]);

/** Each physical lot carries its own balance, which is changed only with an append-only movement record. */
export const inventoryLots = mysqlTable("inventoryLots", {
  id: int("id").autoincrement().primaryKey(),
  medicationId: int("medicationId").notNull(),
  lotNumber: varchar("lotNumber", { length: 120 }).notNull(),
  expiryDate: date("expiryDate", { mode: "string" }).notNull(),
  receivedQuantity: int("receivedQuantity").notNull(),
  remainingQuantity: int("remainingQuantity").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  receivedBy: int("receivedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [uniqueIndex("inventory_lot_unique").on(table.medicationId, table.lotNumber), index("inventory_lots_available_idx").on(table.medicationId, table.expiryDate, table.remainingQuantity)]);

export const clinicalOrders = mysqlTable("clinicalOrders", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().unique(),
  status: mysqlEnum("status", ["DRAFT", "SIGNED", "CANCELLED"]).default("DRAFT").notNull(),
  revision: int("revision").default(1).notNull(),
  createdBy: int("createdBy").notNull(),
  signedBy: int("signedBy"),
  signedAt: timestamp("signedAt"),
  signRequestId: varchar("signRequestId", { length: 100 }).unique(),
  cancelledBy: int("cancelledBy"),
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: varchar("cancelReason", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("clinical_orders_status_idx").on(table.status, table.signedAt)]);

/** Prescription text is snapshot on the order item so later changes in a medicine master do not alter a signed order. */
export const medicationOrderItems = mysqlTable("medicationOrderItems", {
  id: int("id").autoincrement().primaryKey(),
  clinicalOrderId: int("clinicalOrderId").notNull(),
  medicationId: int("medicationId").notNull(),
  medicationNameSnapshot: varchar("medicationNameSnapshot", { length: 600 }).notNull(),
  dosageFormSnapshot: varchar("dosageFormSnapshot", { length: 120 }).notNull(),
  strengthSnapshot: varchar("strengthSnapshot", { length: 120 }).notNull(),
  dose: varchar("dose", { length: 255 }).notNull(),
  frequency: varchar("frequency", { length: 255 }).notNull(),
  duration: varchar("duration", { length: 255 }),
  quantityPrescribed: int("quantityPrescribed").notNull(),
  instructions: varchar("instructions", { length: 1000 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("medication_order_items_order_idx").on(table.clinicalOrderId), index("medication_order_items_medication_idx").on(table.medicationId)]);

export const dispensations = mysqlTable("dispensations", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().unique(),
  clinicalOrderId: int("clinicalOrderId").notNull().unique(),
  status: mysqlEnum("status", ["PENDING", "COMPLETED", "VOIDED"]).default("PENDING").notNull(),
  requestId: varchar("requestId", { length: 100 }).unique(),
  dispensedBy: int("dispensedBy"),
  completedAt: timestamp("completedAt"),
  voidedBy: int("voidedBy"),
  voidedAt: timestamp("voidedAt"),
  voidReason: varchar("voidReason", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("dispensations_status_idx").on(table.status, table.completedAt)]);

export const dispensationItems = mysqlTable("dispensationItems", {
  id: int("id").autoincrement().primaryKey(),
  dispensationId: int("dispensationId").notNull(),
  medicationOrderItemId: int("medicationOrderItemId").notNull(),
  inventoryLotId: int("inventoryLotId").notNull(),
  quantityDispensed: int("quantityDispensed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("dispense_item_order_unique").on(table.dispensationId, table.medicationOrderItemId), index("dispense_items_lot_idx").on(table.inventoryLotId)]);

/** Ledger-style movements are never edited; every deduction has an explicit trace back to its dispensation. */
export const stockMovements = mysqlTable("stockMovements", {
  id: int("id").autoincrement().primaryKey(),
  inventoryLotId: int("inventoryLotId").notNull(),
  movementType: mysqlEnum("movementType", ["RECEIVE", "DISPENSE", "ADJUST", "RETURN", "VOID"]).notNull(),
  quantityDelta: int("quantityDelta").notNull(),
  referenceType: varchar("referenceType", { length: 64 }).notNull(),
  referenceId: varchar("referenceId", { length: 64 }).notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull().unique(),
  performedBy: int("performedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("stock_movements_lot_time_idx").on(table.inventoryLotId, table.createdAt), index("stock_movements_reference_idx").on(table.referenceType, table.referenceId)]);

export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull().unique(),
  invoiceNumber: varchar("invoiceNumber", { length: 48 }).notNull().unique(),
  issueRequestId: varchar("issueRequestId", { length: 100 }).unique(),
  status: mysqlEnum("status", ["DRAFT", "ISSUED", "PAID", "VOID"]).default("DRAFT").notNull(),
  totalSatang: int("totalSatang").default(0).notNull(),
  issuedBy: int("issuedBy").notNull(),
  issuedAt: timestamp("issuedAt"),
  paidAt: timestamp("paidAt"),
  voidedBy: int("voidedBy"),
  voidedAt: timestamp("voidedAt"),
  voidReason: varchar("voidReason", { length: 500 }),
  version: int("version").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("invoices_status_issued_idx").on(table.status, table.issuedAt)]);

/** Service charges are entered by Cashier and remain distinct from medication orders and stock movements. */
export const serviceCharges = mysqlTable("serviceCharges", {
  id: int("id").autoincrement().primaryKey(),
  visitId: int("visitId").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  detail: varchar("detail", { length: 1000 }),
  quantity: int("quantity").notNull(),
  unitPriceSatang: int("unitPriceSatang").notNull(),
  status: mysqlEnum("status", ["PENDING", "INVOICED", "VOID"]).default("PENDING").notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => [index("service_charges_visit_status_idx").on(table.visitId, table.status)]);

export const invoiceLines = mysqlTable("invoiceLines", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  sourceType: varchar("sourceType", { length: 64 }).notNull(),
  sourceId: varchar("sourceId", { length: 64 }).notNull(),
  descriptionSnapshot: varchar("descriptionSnapshot", { length: 1000 }).notNull(),
  quantity: int("quantity").notNull(),
  unitPriceSatang: int("unitPriceSatang").notNull(),
  lineTotalSatang: int("lineTotalSatang").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("invoice_line_source_unique").on(table.invoiceId, table.sourceType, table.sourceId), index("invoice_lines_invoice_idx").on(table.invoiceId)]);

export const payments = mysqlTable("payments", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["CASH", "EXTERNAL_REFERENCE"]).notNull(),
  amountSatang: int("amountSatang").notNull(),
  externalReference: varchar("externalReference", { length: 255 }),
  idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull().unique(),
  receivedBy: int("receivedBy").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
}, table => [index("payments_invoice_time_idx").on(table.invoiceId, table.receivedAt)]);

export const invoiceVoids = mysqlTable("invoiceVoids", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoiceId").notNull().unique(),
  reason: varchar("reason", { length: 500 }).notNull(),
  voidedBy: int("voidedBy").notNull(),
  voidedAt: timestamp("voidedAt").defaultNow().notNull(),
});

/** Audit metadata must contain only technical/contextual values and never patient-identifying or clinical text. */
export const auditEvents = mysqlTable("auditEvents", {
  id: int("id").autoincrement().primaryKey(),
  action: varchar("action", { length: 96 }).notNull(),
  actorUserId: int("actorUserId").notNull(),
  actorRole: mysqlEnum("actorRole", ["SYSTEM_ADMIN", "DOCTOR", "ASSISTANT"]).notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  outcome: mysqlEnum("outcome", ["ALLOWED", "DENIED", "FAILED"]).notNull(),
  requestId: varchar("requestId", { length: 100 }).notNull(),
  metadata: varchar("metadata", { length: 1000 }),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, table => [index("audit_actor_time_idx").on(table.actorUserId, table.occurredAt), index("audit_entity_idx").on(table.entityType, table.entityId)]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Patient = typeof patients.$inferSelect;
export type Visit = typeof visits.$inferSelect;
export type TriageRecord = typeof triageRecords.$inferSelect;
export type QueueEntry = typeof queueEntries.$inferSelect;
export type ClinicalNote = typeof clinicalNotes.$inferSelect;
export type VisitDiagnosis = typeof visitDiagnoses.$inferSelect;
export type Medication = typeof medications.$inferSelect;
export type ClinicalOrder = typeof clinicalOrders.$inferSelect;
export type MedicationOrderItem = typeof medicationOrderItems.$inferSelect;
export type InventoryLot = typeof inventoryLots.$inferSelect;
export type Dispensation = typeof dispensations.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type ServiceCharge = typeof serviceCharges.$inferSelect;
