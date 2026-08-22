-- RELEASE CANDIDATE ONLY — UNAPPLIED.
--
-- This PostgreSQL migration adds the identity-document storage required by the
-- P0 registration control. It is intentionally nullable for existing legacy
-- patient rows. Apply once through the approved production migration process;
-- do not run it automatically from a local development command.

DO $$
BEGIN
  CREATE TYPE "id_document_type" AS ENUM ('THAI_NATIONAL_ID', 'PASSPORT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;
--> statement-breakpoint

ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "idDocumentType" "id_document_type";
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "passportCiphertext" varchar(512);
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "passportLookupHash" varchar(64);
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "passportSetAt" timestamp;
--> statement-breakpoint
ALTER TABLE "patients" ADD COLUMN IF NOT EXISTS "passportSetBy" integer;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "patients_passport_hash_unique"
  ON "patients" USING btree ("passportLookupHash");
