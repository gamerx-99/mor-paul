import { boolean, date, index, integer, numeric, pgEnum, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

// Enums
export const userRoleEnum = pgEnum("user_role", ["SYSTEM_ADMIN", "DOCTOR", "ASSISTANT"]);
export const patientGenderEnum = pgEnum("patient_gender", ["MALE", "FEMALE", "OTHER", "UNSPECIFIED"]);
export const visitStatusEnum = pgEnum("visit_status", ["REGISTERED", "TRIAGED", "WAITING_DOCTOR", "IN_CONSULT", "DISPENSING", "BILLED", "CLOSED", "CANCELLED"]);
export const triageUrgencyEnum = pgEnum("triage_urgency", ["ROUTINE", "PRIORITY", "URGENT"]);
export const queueStatusEnum = pgEnum("queue_status", ["WAITING", "CALLED", "IN_CONSULT", "COMPLETED", "CANCELLED"]);
export const clinicalNoteStatusEnum = pgEnum("clinical_note_status", ["DRAFT", "SIGNED"]);
export const clinicalOrderStatusEnum = pgEnum("clinical_order_status", ["DRAFT", "SIGNED", "CANCELLED"]);
export const dispensationStatusEnum = pgEnum("dispensation_status", ["PENDING", "COMPLETED", "VOIDED"]);
export const stockMovementTypeEnum = pgEnum("stock_movement_type", ["RECEIVE", "DISPENSE", "ADJUST", "RETURN", "VOID"]);
export const invoiceStatusEnum = pgEnum("invoice_status", ["DRAFT", "ISSUED", "PAID", "VOID"]);
export const serviceChargeStatusEnum = pgEnum("service_charge_status", ["PENDING", "INVOICED", "VOID"]);
export const paymentMethodEnum = pgEnum("payment_method", ["CASH", "PROMPTPAY", "EXTERNAL_REFERENCE", "CREDIT_CARD"]);
export const auditOutcomeEnum = pgEnum("audit_outcome", ["ALLOWED", "DENIED", "FAILED"]);

/**
 * Local clinic accounts are deliberately separate from Manus OAuth. Passwords
 * are never stored here; only a slow, salted password hash is persisted.
 */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: varchar("username", { length: 32 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  displayName: varchar("displayName", { length: 120 }).notNull(),
  role: userRoleEnum("role").default("ASSISTANT").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  mustChangePassword: boolean("mustChangePassword").default(false).notNull(),
  failedLoginCount: integer("failedLoginCount").default(0).notNull(),
  lockedUntil: timestamp("lockedUntil"),
  lastLoginAt: timestamp("lastLoginAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

/** Opaque sessions keep raw bearer tokens out of the database and allow logout/revocation. */
export const userSessions = pgTable("userSessions", {
  id: serial("id").primaryKey(),
  tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
  userId: integer("userId").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/**
 * Identifying and contact data is kept in the patient record only. It is never
 * copied to audit events and is available exclusively through PHI procedures.
 */
export const patients = pgTable("patients", {
  id: serial("id").primaryKey(),
  hn: varchar("hn", { length: 24 }).notNull().unique(),
  firstName: varchar("firstName", { length: 120 }).notNull(),
  lastName: varchar("lastName", { length: 120 }).notNull(),
  dateOfBirth: date("dateOfBirth", { mode: "string" }).notNull(),
  gender: patientGenderEnum("gender").default("UNSPECIFIED").notNull(),
  phone: varchar("phone", { length: 32 }),
  address: text("address"),
  allergySummary: varchar("allergySummary", { length: 1000 }),
  /** Ciphertext and keyed lookup are deliberately never selected by client-facing patient queries. */
  nationalIdCiphertext: varchar("nationalIdCiphertext", { length: 512 }),
  nationalIdLookupHash: varchar("nationalIdLookupHash", { length: 64 }),
  nationalIdSetAt: timestamp("nationalIdSetAt"),
  nationalIdSetBy: integer("nationalIdSetBy"),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("patients_name_idx").on(table.lastName, table.firstName), uniqueIndex("patients_national_id_hash_unique").on(table.nationalIdLookupHash)]);

export const visits = pgTable("visits", {
  id: serial("id").primaryKey(),
  patientId: integer("patientId").notNull(),
  visitDate: date("visitDate", { mode: "string" }).notNull(),
  chiefComplaint: varchar("chiefComplaint", { length: 2000 }).notNull(),
  status: visitStatusEnum("status").default("REGISTERED").notNull(),
  version: integer("version").default(1).notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("visits_patient_idx").on(table.patientId), index("visits_date_status_idx").on(table.visitDate, table.status)]);

export const triageRecords = pgTable("triageRecords", {
  id: serial("id").primaryKey(),
  visitId: integer("visitId").notNull().unique(),
  bloodPressureSystolic: integer("bloodPressureSystolic"),
  bloodPressureDiastolic: integer("bloodPressureDiastolic"),
  pulse: integer("pulse"),
  temperatureCelsius: numeric("temperatureCelsius", { precision: 4, scale: 1 }),
  oxygenSaturation: integer("oxygenSaturation"),
  weightKg: numeric("weightKg", { precision: 5, scale: 2 }),
  heightCm: numeric("heightCm", { precision: 5, scale: 2 }),
  triageNote: varchar("triageNote", { length: 2000 }),
  urgency: triageUrgencyEnum("urgency").default("ROUTINE").notNull(),
  performedBy: integer("performedBy").notNull(),
  performedAt: timestamp("performedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("triage_performed_at_idx").on(table.performedAt)]);

export const queueEntries = pgTable("queueEntries", {
  id: serial("id").primaryKey(),
  visitId: integer("visitId").notNull().unique(),
  queueDate: date("queueDate", { mode: "string" }).notNull(),
  queueNumber: integer("queueNumber").notNull(),
  status: queueStatusEnum("status").default("WAITING").notNull(),
  assignedTo: integer("assignedTo"),
  calledAt: timestamp("calledAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [uniqueIndex("queue_date_number_unique").on(table.queueDate, table.queueNumber), index("queue_date_status_idx").on(table.queueDate, table.status)]);

/** One editable clinical draft per visit. Signing locks the original clinical narrative. */
export const clinicalNotes = pgTable("clinicalNotes", {
  id: serial("id").primaryKey(),
  visitId: integer("visitId").notNull().unique(),
  subjective: text("subjective"),
  objective: text("objective"),
  assessment: text("assessment"),
  plan: text("plan"),
  status: clinicalNoteStatusEnum("status").default("DRAFT").notNull(),
  revision: integer("revision").default(1).notNull(),
  authoredBy: integer("authoredBy").notNull(),
  signedAt: timestamp("signedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("clinical_notes_author_status_idx").on(table.authoredBy, table.status)]);

/** Diagnosis entries are written by the clinician at signing time; no diagnosis catalogue is seeded. */
export const visitDiagnoses = pgTable("visitDiagnoses", {
  id: serial("id").primaryKey(),
  visitId: integer("visitId").notNull(),
  code: varchar("code", { length: 32 }),
  display: varchar("display", { length: 1000 }).notNull(),
  rank: integer("rank").notNull(),
  enteredBy: integer("enteredBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("visit_diagnoses_rank_unique").on(table.visitId, table.rank), index("visit_diagnoses_visit_idx").on(table.visitId)]);

/** Medicine master data begins empty and contains no patient or prescription information. */
export const medications = pgTable("medications", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  genericName: varchar("genericName", { length: 255 }).notNull(),
  tradeName: varchar("tradeName", { length: 255 }),
  dosageForm: varchar("dosageForm", { length: 120 }).notNull(),
  strength: varchar("strength", { length: 120 }).notNull(),
  minStockThreshold: integer("minStockThreshold").default(10).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("medications_active_name_idx").on(table.isActive, table.genericName)]);

/** Prices are versioned; invoices snapshot the charged price and never reread this table. */
export const medicationPrices = pgTable("medicationPrices", {
  id: serial("id").primaryKey(),
  medicationId: integer("medicationId").notNull(),
  unitPriceSatang: integer("unitPriceSatang").notNull(),
  effectiveFrom: timestamp("effectiveFrom").defaultNow().notNull(),
  effectiveTo: timestamp("effectiveTo"),
  isActive: boolean("isActive").default(true).notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("medication_prices_lookup_idx").on(table.medicationId, table.isActive, table.effectiveFrom)]);

/** Each physical lot carries its own balance, which is changed only with an append-only movement record. */
export const inventoryLots = pgTable("inventoryLots", {
  id: serial("id").primaryKey(),
  medicationId: integer("medicationId").notNull(),
  lotNumber: varchar("lotNumber", { length: 120 }).notNull(),
  expiryDate: date("expiryDate", { mode: "string" }).notNull(),
  receivedQuantity: integer("receivedQuantity").notNull(),
  remainingQuantity: integer("remainingQuantity").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
  receivedBy: integer("receivedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [uniqueIndex("inventory_lot_unique").on(table.medicationId, table.lotNumber), index("inventory_lots_available_idx").on(table.medicationId, table.expiryDate, table.remainingQuantity)]);

export const clinicalOrders = pgTable("clinicalOrders", {
  id: serial("id").primaryKey(),
  visitId: integer("visitId").notNull().unique(),
  status: clinicalOrderStatusEnum("status").default("DRAFT").notNull(),
  revision: integer("revision").default(1).notNull(),
  createdBy: integer("createdBy").notNull(),
  signedBy: integer("signedBy"),
  signedAt: timestamp("signedAt"),
  signRequestId: varchar("signRequestId", { length: 100 }).unique(),
  cancelledBy: integer("cancelledBy"),
  cancelledAt: timestamp("cancelledAt"),
  cancelReason: varchar("cancelReason", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("clinical_orders_status_idx").on(table.status, table.signedAt)]);

/** Prescription text is snapshot on the order item so later changes in a medicine master do not alter a signed order. */
export const medicationOrderItems = pgTable("medicationOrderItems", {
  id: serial("id").primaryKey(),
  clinicalOrderId: integer("clinicalOrderId").notNull(),
  medicationId: integer("medicationId").notNull(),
  medicationNameSnapshot: varchar("medicationNameSnapshot", { length: 600 }).notNull(),
  dosageFormSnapshot: varchar("dosageFormSnapshot", { length: 120 }).notNull(),
  strengthSnapshot: varchar("strengthSnapshot", { length: 120 }).notNull(),
  dose: varchar("dose", { length: 255 }).notNull(),
  frequency: varchar("frequency", { length: 255 }).notNull(),
  duration: varchar("duration", { length: 255 }),
  quantityPrescribed: integer("quantityPrescribed").notNull(),
  instructions: varchar("instructions", { length: 1000 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("medication_order_items_order_idx").on(table.clinicalOrderId), index("medication_order_items_medication_idx").on(table.medicationId)]);

export const dispensations = pgTable("dispensations", {
  id: serial("id").primaryKey(),
  visitId: integer("visitId").notNull().unique(),
  clinicalOrderId: integer("clinicalOrderId").notNull().unique(),
  status: dispensationStatusEnum("status").default("PENDING").notNull(),
  requestId: varchar("requestId", { length: 100 }).unique(),
  dispensedBy: integer("dispensedBy"),
  completedAt: timestamp("completedAt"),
  voidedBy: integer("voidedBy"),
  voidedAt: timestamp("voidedAt"),
  voidReason: varchar("voidReason", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("dispensations_status_idx").on(table.status, table.completedAt)]);

export const dispensationItems = pgTable("dispensationItems", {
  id: serial("id").primaryKey(),
  dispensationId: integer("dispensationId").notNull(),
  medicationOrderItemId: integer("medicationOrderItemId").notNull(),
  inventoryLotId: integer("inventoryLotId").notNull(),
  quantityDispensed: integer("quantityDispensed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("dispense_item_order_unique").on(table.dispensationId, table.medicationOrderItemId), index("dispense_items_lot_idx").on(table.inventoryLotId)]);

/** Ledger-style movements are never edited; every deduction has an explicit trace back to its dispensation. */
export const stockMovements = pgTable("stockMovements", {
  id: serial("id").primaryKey(),
  inventoryLotId: integer("inventoryLotId").notNull(),
  movementType: stockMovementTypeEnum("movementType").notNull(),
  quantityDelta: integer("quantityDelta").notNull(),
  referenceType: varchar("referenceType", { length: 64 }).notNull(),
  referenceId: varchar("referenceId", { length: 64 }).notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull().unique(),
  performedBy: integer("performedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [index("stock_movements_lot_time_idx").on(table.inventoryLotId, table.createdAt), index("stock_movements_reference_idx").on(table.referenceType, table.referenceId)]);

export const invoices = pgTable("invoices", {
  id: serial("id").primaryKey(),
  visitId: integer("visitId").notNull().unique(),
  invoiceNumber: varchar("invoiceNumber", { length: 48 }).notNull().unique(),
  issueRequestId: varchar("issueRequestId", { length: 100 }).unique(),
  status: invoiceStatusEnum("status").default("DRAFT").notNull(),
  subtotalSatang: integer("subtotalSatang").default(0).notNull(),
  discountSatang: integer("discountSatang").default(0).notNull(),
  discountReason: varchar("discountReason", { length: 500 }),
  discountApprovedBy: integer("discountApprovedBy"),
  totalSatang: integer("totalSatang").default(0).notNull(),
  issuedBy: integer("issuedBy").notNull(),
  issuedAt: timestamp("issuedAt"),
  paidAt: timestamp("paidAt"),
  voidedBy: integer("voidedBy"),
  voidedAt: timestamp("voidedAt"),
  voidReason: varchar("voidReason", { length: 500 }),
  version: integer("version").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("invoices_status_issued_idx").on(table.status, table.issuedAt)]);

/** Service charges are entered by Cashier and remain distinct from medication orders and stock movements. */
export const serviceCharges = pgTable("serviceCharges", {
  id: serial("id").primaryKey(),
  visitId: integer("visitId").notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  detail: varchar("detail", { length: 1000 }),
  quantity: integer("quantity").notNull(),
  unitPriceSatang: integer("unitPriceSatang").notNull(),
  status: serviceChargeStatusEnum("status").default("PENDING").notNull(),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("service_charges_visit_status_idx").on(table.visitId, table.status)]);

export const invoiceLines = pgTable("invoiceLines", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoiceId").notNull(),
  sourceType: varchar("sourceType", { length: 64 }).notNull(),
  sourceId: varchar("sourceId", { length: 64 }).notNull(),
  descriptionSnapshot: varchar("descriptionSnapshot", { length: 1000 }).notNull(),
  quantity: integer("quantity").notNull(),
  unitPriceSatang: integer("unitPriceSatang").notNull(),
  lineTotalSatang: integer("lineTotalSatang").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => [uniqueIndex("invoice_line_source_unique").on(table.invoiceId, table.sourceType, table.sourceId), index("invoice_lines_invoice_idx").on(table.invoiceId)]);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoiceId").notNull(),
  paymentMethod: paymentMethodEnum("paymentMethod").notNull(),
  amountSatang: integer("amountSatang").notNull(),
  externalReference: varchar("externalReference", { length: 255 }),
  idempotencyKey: varchar("idempotencyKey", { length: 100 }).notNull().unique(),
  receivedBy: integer("receivedBy").notNull(),
  receivedAt: timestamp("receivedAt").defaultNow().notNull(),
}, table => [index("payments_invoice_time_idx").on(table.invoiceId, table.receivedAt)]);

export const invoiceVoids = pgTable("invoiceVoids", {
  id: serial("id").primaryKey(),
  invoiceId: integer("invoiceId").notNull().unique(),
  reason: varchar("reason", { length: 500 }).notNull(),
  voidedBy: integer("voidedBy").notNull(),
  voidedAt: timestamp("voidedAt").defaultNow().notNull(),
});

/** Daily cash reconciliation and shift closeout table */
export const dailyCloseouts = pgTable("dailyCloseouts", {
  id: serial("id").primaryKey(),
  closeoutDate: date("closeoutDate", { mode: "string" }).notNull().unique(),
  closedBy: integer("closedBy").notNull(),
  totalCashExpectedSatang: integer("totalCashExpectedSatang").notNull(),
  totalCashCountedSatang: integer("totalCashCountedSatang").notNull(),
  cashDifferenceSatang: integer("cashDifferenceSatang").notNull(),
  totalPromptPaySatang: integer("totalPromptPaySatang").notNull(),
  totalOtherSatang: integer("totalOtherSatang").notNull(),
  totalRevenueSatang: integer("totalRevenueSatang").notNull(),
  totalInvoicesCount: integer("totalInvoicesCount").notNull(),
  notes: varchar("notes", { length: 500 }),
  closedAt: timestamp("closedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("daily_closeouts_date_idx").on(table.closeoutDate)]);

/** Audit metadata must contain only technical/contextual values and never patient-identifying or clinical text. */
export const auditEvents = pgTable("auditEvents", {
  id: serial("id").primaryKey(),
  action: varchar("action", { length: 96 }).notNull(),
  actorUserId: integer("actorUserId").notNull(),
  actorRole: userRoleEnum("actorRole").notNull(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: varchar("entityId", { length: 64 }).notNull(),
  outcome: auditOutcomeEnum("outcome").notNull(),
  requestId: varchar("requestId", { length: 100 }).notNull(),
  metadata: varchar("metadata", { length: 1000 }),
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, table => [index("audit_actor_time_idx").on(table.actorUserId, table.occurredAt), index("audit_entity_idx").on(table.entityType, table.entityId)]);

export const clinicalPresets = pgTable("clinicalPresets", {
  id: serial("id").primaryKey(),
  doctorId: integer("doctorId").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 500 }),
  diagnosesJson: text("diagnosesJson").notNull(),
  medicationsJson: text("medicationsJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [index("clinical_presets_doctor_idx").on(table.doctorId)]);

export const soapTemplates = pgTable("soapTemplates", {
  id: serial("id").primaryKey(),
  serviceType: varchar("serviceType", { length: 40 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  subjectiveTemplate: text("subjectiveTemplate").notNull(),
  objectiveTemplate: text("objectiveTemplate").notNull(),
  assessmentTemplate: text("assessmentTemplate").notNull(),
  planTemplate: text("planTemplate").notNull(),
  isActive: boolean("isActive").notNull().default(true),
  createdBy: integer("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
}, table => [
  index("soap_templates_service_idx").on(table.serviceType, table.isActive),
]);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Patient = typeof patients.$inferSelect;
export type InsertPatient = typeof patients.$inferInsert;
export type Visit = typeof visits.$inferSelect;
export type InsertVisit = typeof visits.$inferInsert;
export type TriageRecord = typeof triageRecords.$inferSelect;
export type QueueEntry = typeof queueEntries.$inferSelect;
export type ClinicalNote = typeof clinicalNotes.$inferSelect;
export type InsertClinicalNote = typeof clinicalNotes.$inferInsert;
export type VisitDiagnosis = typeof visitDiagnoses.$inferSelect;
export type Medication = typeof medications.$inferSelect;
export type InsertMedication = typeof medications.$inferInsert;
export type ClinicalOrder = typeof clinicalOrders.$inferSelect;
export type MedicationOrderItem = typeof medicationOrderItems.$inferSelect;
export type InventoryLot = typeof inventoryLots.$inferSelect;
export type InsertInventoryLot = typeof inventoryLots.$inferInsert;
export type Dispensation = typeof dispensations.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type DailyCloseout = typeof dailyCloseouts.$inferSelect;
export type InsertDailyCloseout = typeof dailyCloseouts.$inferInsert;
export type ServiceCharge = typeof serviceCharges.$inferSelect;
export type ClinicalPreset = typeof clinicalPresets.$inferSelect;
