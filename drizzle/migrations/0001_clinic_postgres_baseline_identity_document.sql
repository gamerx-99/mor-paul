CREATE TYPE "public"."id_document_type" AS ENUM('THAI_NATIONAL_ID', 'PASSPORT');--> statement-breakpoint
CREATE TABLE "soapTemplates" (
	"id" serial PRIMARY KEY NOT NULL,
	"serviceType" varchar(40) NOT NULL,
	"name" varchar(120) NOT NULL,
	"subjectiveTemplate" text NOT NULL,
	"objectiveTemplate" text NOT NULL,
	"assessmentTemplate" text NOT NULL,
	"planTemplate" text NOT NULL,
	"isActive" boolean DEFAULT true NOT NULL,
	"createdBy" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "idDocumentType" "id_document_type";--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "passportCiphertext" varchar(512);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "passportLookupHash" varchar(64);--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "passportSetAt" timestamp;--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN "passportSetBy" integer;--> statement-breakpoint
CREATE INDEX "soap_templates_service_idx" ON "soapTemplates" USING btree ("serviceType","isActive");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_passport_hash_unique" ON "patients" USING btree ("passportLookupHash");
