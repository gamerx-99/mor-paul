CREATE TYPE "public"."audit_outcome" AS ENUM('ALLOWED', 'DENIED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."clinical_note_status" AS ENUM('DRAFT', 'SIGNED');--> statement-breakpoint
CREATE TYPE "public"."clinical_order_status" AS ENUM('DRAFT', 'SIGNED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."dispensation_status" AS ENUM('PENDING', 'COMPLETED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('DRAFT', 'ISSUED', 'PAID', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."patient_gender" AS ENUM('MALE', 'FEMALE', 'OTHER', 'UNSPECIFIED');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'PROMPTPAY', 'EXTERNAL_REFERENCE', 'CREDIT_CARD');--> statement-breakpoint
CREATE TYPE "public"."queue_status" AS ENUM('WAITING', 'CALLED', 'IN_CONSULT', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."service_charge_status" AS ENUM('PENDING', 'INVOICED', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('RECEIVE', 'DISPENSE', 'ADJUST', 'RETURN', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."triage_urgency" AS ENUM('ROUTINE', 'PRIORITY', 'URGENT');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('SYSTEM_ADMIN', 'DOCTOR', 'ASSISTANT');--> statement-breakpoint
CREATE TYPE "public"."visit_status" AS ENUM('REGISTERED', 'TRIAGED', 'WAITING_DOCTOR', 'IN_CONSULT', 'DISPENSING', 'BILLED', 'CLOSED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "auditEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"action" varchar(96) NOT NULL,
	"actorUserId" integer NOT NULL,
	"actorRole" "user_role" NOT NULL,
	"entityType" varchar(64) NOT NULL,
	"entityId" varchar(64) NOT NULL,
	"outcome" "audit_outcome" NOT NULL,
	"requestId" varchar(100) NOT NULL,
	"metadata" varchar(1000),
	"occurredAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "clinicalNotes" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitId" integer NOT NULL,
	"subjective" text,
	"objective" text,
	"assessment" text,
	"plan" text,
	"status" "clinical_note_status" DEFAULT 'DRAFT' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"authoredBy" integer NOT NULL,
	"signedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clinicalNotes_visitId_unique" UNIQUE("visitId")
);
--> statement-breakpoint
CREATE TABLE "clinicalOrders" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitId" integer NOT NULL,
	"status" "clinical_order_status" DEFAULT 'DRAFT' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"createdBy" integer NOT NULL,
	"signedBy" integer,
	"signedAt" timestamp,
	"signRequestId" varchar(100),
	"cancelledBy" integer,
	"cancelledAt" timestamp,
	"cancelReason" varchar(500),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "clinicalOrders_visitId_unique" UNIQUE("visitId"),
	CONSTRAINT "clinicalOrders_signRequestId_unique" UNIQUE("signRequestId")
);
--> statement-breakpoint
CREATE TABLE "clinicalPresets" (
	"id" serial PRIMARY KEY NOT NULL,
	"doctorId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(500),
	"diagnosesJson" text NOT NULL,
	"medicationsJson" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dailyCloseouts" (
	"id" serial PRIMARY KEY NOT NULL,
	"closeoutDate" date NOT NULL,
	"closedBy" integer NOT NULL,
	"totalCashExpectedSatang" integer NOT NULL,
	"totalCashCountedSatang" integer NOT NULL,
	"cashDifferenceSatang" integer NOT NULL,
	"totalPromptPaySatang" integer NOT NULL,
	"totalOtherSatang" integer NOT NULL,
	"totalRevenueSatang" integer NOT NULL,
	"totalInvoicesCount" integer NOT NULL,
	"notes" varchar(500),
	"closedAt" timestamp DEFAULT now() NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dailyCloseouts_closeoutDate_unique" UNIQUE("closeoutDate")
);
--> statement-breakpoint
CREATE TABLE "dispensationItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"dispensationId" integer NOT NULL,
	"medicationOrderItemId" integer NOT NULL,
	"inventoryLotId" integer NOT NULL,
	"quantityDispensed" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispensations" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitId" integer NOT NULL,
	"clinicalOrderId" integer NOT NULL,
	"status" "dispensation_status" DEFAULT 'PENDING' NOT NULL,
	"requestId" varchar(100),
	"dispensedBy" integer,
	"completedAt" timestamp,
	"voidedBy" integer,
	"voidedAt" timestamp,
	"voidReason" varchar(500),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dispensations_visitId_unique" UNIQUE("visitId"),
	CONSTRAINT "dispensations_clinicalOrderId_unique" UNIQUE("clinicalOrderId"),
	CONSTRAINT "dispensations_requestId_unique" UNIQUE("requestId")
);
--> statement-breakpoint
CREATE TABLE "inventoryLots" (
	"id" serial PRIMARY KEY NOT NULL,
	"medicationId" integer NOT NULL,
	"lotNumber" varchar(120) NOT NULL,
	"expiryDate" date NOT NULL,
	"receivedQuantity" integer NOT NULL,
	"remainingQuantity" integer NOT NULL,
	"receivedAt" timestamp DEFAULT now() NOT NULL,
	"receivedBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoiceLines" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoiceId" integer NOT NULL,
	"sourceType" varchar(64) NOT NULL,
	"sourceId" varchar(64) NOT NULL,
	"descriptionSnapshot" varchar(1000) NOT NULL,
	"quantity" integer NOT NULL,
	"unitPriceSatang" integer NOT NULL,
	"lineTotalSatang" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoiceVoids" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoiceId" integer NOT NULL,
	"reason" varchar(500) NOT NULL,
	"voidedBy" integer NOT NULL,
	"voidedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoiceVoids_invoiceId_unique" UNIQUE("invoiceId")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitId" integer NOT NULL,
	"invoiceNumber" varchar(48) NOT NULL,
	"issueRequestId" varchar(100),
	"status" "invoice_status" DEFAULT 'DRAFT' NOT NULL,
	"subtotalSatang" integer DEFAULT 0 NOT NULL,
	"discountSatang" integer DEFAULT 0 NOT NULL,
	"discountReason" varchar(500),
	"discountApprovedBy" integer,
	"totalSatang" integer DEFAULT 0 NOT NULL,
	"issuedBy" integer NOT NULL,
	"issuedAt" timestamp,
	"paidAt" timestamp,
	"voidedBy" integer,
	"voidedAt" timestamp,
	"voidReason" varchar(500),
	"version" integer DEFAULT 1 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_visitId_unique" UNIQUE("visitId"),
	CONSTRAINT "invoices_invoiceNumber_unique" UNIQUE("invoiceNumber"),
	CONSTRAINT "invoices_issueRequestId_unique" UNIQUE("issueRequestId")
);
--> statement-breakpoint
CREATE TABLE "medicationOrderItems" (
	"id" serial PRIMARY KEY NOT NULL,
	"clinicalOrderId" integer NOT NULL,
	"medicationId" integer NOT NULL,
	"medicationNameSnapshot" varchar(600) NOT NULL,
	"dosageFormSnapshot" varchar(120) NOT NULL,
	"strengthSnapshot" varchar(120) NOT NULL,
	"dose" varchar(255) NOT NULL,
	"frequency" varchar(255) NOT NULL,
	"duration" varchar(255),
	"quantityPrescribed" integer NOT NULL,
	"instructions" varchar(1000),
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicationPrices" (
	"id" serial PRIMARY KEY NOT NULL,
	"medicationId" integer NOT NULL,
	"unitPriceSatang" integer NOT NULL,
	"effectiveFrom" timestamp DEFAULT now() NOT NULL,
	"effectiveTo" timestamp,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medications" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(64) NOT NULL,
	"genericName" varchar(255) NOT NULL,
	"tradeName" varchar(255),
	"dosageForm" varchar(120) NOT NULL,
	"strength" varchar(120) NOT NULL,
	"minStockThreshold" integer DEFAULT 10 NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "medications_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" serial PRIMARY KEY NOT NULL,
	"hn" varchar(24) NOT NULL,
	"firstName" varchar(120) NOT NULL,
	"lastName" varchar(120) NOT NULL,
	"dateOfBirth" date NOT NULL,
	"gender" "patient_gender" DEFAULT 'UNSPECIFIED' NOT NULL,
	"phone" varchar(32),
	"address" text,
	"allergySummary" varchar(1000),
	"nationalIdCiphertext" varchar(512),
	"nationalIdLookupHash" varchar(64),
	"nationalIdSetAt" timestamp,
	"nationalIdSetBy" integer,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patients_hn_unique" UNIQUE("hn")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoiceId" integer NOT NULL,
	"paymentMethod" "payment_method" NOT NULL,
	"amountSatang" integer NOT NULL,
	"externalReference" varchar(255),
	"idempotencyKey" varchar(100) NOT NULL,
	"receivedBy" integer NOT NULL,
	"receivedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payments_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "queueEntries" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitId" integer NOT NULL,
	"queueDate" date NOT NULL,
	"queueNumber" integer NOT NULL,
	"status" "queue_status" DEFAULT 'WAITING' NOT NULL,
	"assignedTo" integer,
	"calledAt" timestamp,
	"completedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "queueEntries_visitId_unique" UNIQUE("visitId")
);
--> statement-breakpoint
CREATE TABLE "serviceCharges" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitId" integer NOT NULL,
	"description" varchar(500) NOT NULL,
	"detail" varchar(1000),
	"quantity" integer NOT NULL,
	"unitPriceSatang" integer NOT NULL,
	"status" "service_charge_status" DEFAULT 'PENDING' NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stockMovements" (
	"id" serial PRIMARY KEY NOT NULL,
	"inventoryLotId" integer NOT NULL,
	"movementType" "stock_movement_type" NOT NULL,
	"quantityDelta" integer NOT NULL,
	"referenceType" varchar(64) NOT NULL,
	"referenceId" varchar(64) NOT NULL,
	"idempotencyKey" varchar(100) NOT NULL,
	"performedBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stockMovements_idempotencyKey_unique" UNIQUE("idempotencyKey")
);
--> statement-breakpoint
CREATE TABLE "triageRecords" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitId" integer NOT NULL,
	"bloodPressureSystolic" integer,
	"bloodPressureDiastolic" integer,
	"pulse" integer,
	"temperatureCelsius" numeric(4, 1),
	"oxygenSaturation" integer,
	"weightKg" numeric(5, 2),
	"heightCm" numeric(5, 2),
	"triageNote" varchar(2000),
	"urgency" "triage_urgency" DEFAULT 'ROUTINE' NOT NULL,
	"performedBy" integer NOT NULL,
	"performedAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "triageRecords_visitId_unique" UNIQUE("visitId")
);
--> statement-breakpoint
CREATE TABLE "userSessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"userId" integer NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"lastSeenAt" timestamp DEFAULT now() NOT NULL,
	"revokedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "userSessions_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" varchar(32) NOT NULL,
	"passwordHash" varchar(255) NOT NULL,
	"displayName" varchar(120) NOT NULL,
	"role" "user_role" DEFAULT 'ASSISTANT' NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"mustChangePassword" boolean DEFAULT false NOT NULL,
	"failedLoginCount" integer DEFAULT 0 NOT NULL,
	"lockedUntil" timestamp,
	"lastLoginAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "visitDiagnoses" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitId" integer NOT NULL,
	"code" varchar(32),
	"display" varchar(1000) NOT NULL,
	"rank" integer NOT NULL,
	"enteredBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"patientId" integer NOT NULL,
	"visitDate" date NOT NULL,
	"chiefComplaint" varchar(2000) NOT NULL,
	"status" "visit_status" DEFAULT 'REGISTERED' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "audit_actor_time_idx" ON "auditEvents" USING btree ("actorUserId","occurredAt");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "auditEvents" USING btree ("entityType","entityId");--> statement-breakpoint
CREATE INDEX "clinical_notes_author_status_idx" ON "clinicalNotes" USING btree ("authoredBy","status");--> statement-breakpoint
CREATE INDEX "clinical_orders_status_idx" ON "clinicalOrders" USING btree ("status","signedAt");--> statement-breakpoint
CREATE INDEX "clinical_presets_doctor_idx" ON "clinicalPresets" USING btree ("doctorId");--> statement-breakpoint
CREATE INDEX "daily_closeouts_date_idx" ON "dailyCloseouts" USING btree ("closeoutDate");--> statement-breakpoint
CREATE UNIQUE INDEX "dispense_item_order_unique" ON "dispensationItems" USING btree ("dispensationId","medicationOrderItemId");--> statement-breakpoint
CREATE INDEX "dispense_items_lot_idx" ON "dispensationItems" USING btree ("inventoryLotId");--> statement-breakpoint
CREATE INDEX "dispensations_status_idx" ON "dispensations" USING btree ("status","completedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_lot_unique" ON "inventoryLots" USING btree ("medicationId","lotNumber");--> statement-breakpoint
CREATE INDEX "inventory_lots_available_idx" ON "inventoryLots" USING btree ("medicationId","expiryDate","remainingQuantity");--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_line_source_unique" ON "invoiceLines" USING btree ("invoiceId","sourceType","sourceId");--> statement-breakpoint
CREATE INDEX "invoice_lines_invoice_idx" ON "invoiceLines" USING btree ("invoiceId");--> statement-breakpoint
CREATE INDEX "invoices_status_issued_idx" ON "invoices" USING btree ("status","issuedAt");--> statement-breakpoint
CREATE INDEX "medication_order_items_order_idx" ON "medicationOrderItems" USING btree ("clinicalOrderId");--> statement-breakpoint
CREATE INDEX "medication_order_items_medication_idx" ON "medicationOrderItems" USING btree ("medicationId");--> statement-breakpoint
CREATE INDEX "medication_prices_lookup_idx" ON "medicationPrices" USING btree ("medicationId","isActive","effectiveFrom");--> statement-breakpoint
CREATE INDEX "medications_active_name_idx" ON "medications" USING btree ("isActive","genericName");--> statement-breakpoint
CREATE INDEX "patients_name_idx" ON "patients" USING btree ("lastName","firstName");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_national_id_hash_unique" ON "patients" USING btree ("nationalIdLookupHash");--> statement-breakpoint
CREATE INDEX "payments_invoice_time_idx" ON "payments" USING btree ("invoiceId","receivedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_date_number_unique" ON "queueEntries" USING btree ("queueDate","queueNumber");--> statement-breakpoint
CREATE INDEX "queue_date_status_idx" ON "queueEntries" USING btree ("queueDate","status");--> statement-breakpoint
CREATE INDEX "service_charges_visit_status_idx" ON "serviceCharges" USING btree ("visitId","status");--> statement-breakpoint
CREATE INDEX "stock_movements_lot_time_idx" ON "stockMovements" USING btree ("inventoryLotId","createdAt");--> statement-breakpoint
CREATE INDEX "stock_movements_reference_idx" ON "stockMovements" USING btree ("referenceType","referenceId");--> statement-breakpoint
CREATE INDEX "triage_performed_at_idx" ON "triageRecords" USING btree ("performedAt");--> statement-breakpoint
CREATE UNIQUE INDEX "visit_diagnoses_rank_unique" ON "visitDiagnoses" USING btree ("visitId","rank");--> statement-breakpoint
CREATE INDEX "visit_diagnoses_visit_idx" ON "visitDiagnoses" USING btree ("visitId");--> statement-breakpoint
CREATE INDEX "visits_patient_idx" ON "visits" USING btree ("patientId");--> statement-breakpoint
CREATE INDEX "visits_date_status_idx" ON "visits" USING btree ("visitDate","status");