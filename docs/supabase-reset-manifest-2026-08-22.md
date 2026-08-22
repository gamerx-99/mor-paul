# Supabase Schema Reset Manifest — A2

## Purpose

This manifest documents the proposed reset of the **`public` schema only** in the Supabase project `mor-paul`, followed by application of the PostgreSQL schema described by the current Drizzle migration history. It is prepared under the owner's selected option **A2** because the existing database schema does not match the release-candidate source mappings.

> **Status: NOT EXECUTED.** This document does not authorize the destructive SQL below. A separate final confirmation is required immediately before execution.

## Verified target and baseline

| Item | Verified state |
| --- | --- |
| Supabase project | `mor-paul` (`xjwzbwqtdlufflturird`) |
| Schema in scope | `public` only |
| Existing application tables | 20 |
| Reported table rows | 0 for every listed application table |
| Existing RLS state | Enabled on every listed application table |
| Existing custom `public` enums | 9 |
| Existing Drizzle history | No Drizzle migration history found |
| Extensions outside `public` | Retained; not part of the reset |

The reported empty state is metadata only. It is **not** a substitute for an approved backup strategy or an independent owner check.

## Objects that the reset will remove

The SQL will run `DROP SCHEMA public CASCADE`, which removes all current objects in `public`, including these verified application tables:

`users`, `user_sessions`, `patients`, `visits`, `triage_records`, `queue_entries`, `clinical_notes`, `visit_diagnoses`, `medications`, `medication_prices`, `inventory_lots`, `clinical_orders`, `medication_order_items`, `stock_movements`, `dispensations`, `dispensation_items`, `service_charges`, `invoices`, `invoice_lines`, `payments`, and `audit_events`.

It will also remove the current `public` enums and any `public` functions, views, policies, grants, sequences, triggers, or indexes dependent on those objects. It will **not** intentionally remove Supabase-managed schemas or installed extensions such as `extensions`, `auth`, `storage`, or `vault`.

## Rebuild sequence

1. Execute the reviewed reset SQL in `drizzle/manual/20260822_reset_public_schema_A2.unapplied.sql`.
2. Use the PostgreSQL `DATABASE_URL` for this exact Supabase target to run `pnpm drizzle-kit migrate`, which should apply `0000_stale_boomer.sql` and `0001_clinic_postgres_baseline_identity_document.sql` and record the outcome in Drizzle's migration history.
3. Verify the expected 25 application tables, expected `id_document_type` enum and patient identity-document columns/indexes, and an empty data state.
4. Re-run TypeScript, targeted identity-document tests, and production build. No patient, clinical, medication, or financial records will be seeded.

## Blocking prerequisites

- A PostgreSQL `DATABASE_URL` for **this** Supabase project is required to use `drizzle-kit migrate`. The only current environment connection is MySQL/MariaDB and must not be used.
- The owner must issue a final explicit confirmation after reviewing the reset scope.
- If the owner cannot supply a direct PostgreSQL connection, the reset and generated Drizzle SQL must not be described as a Drizzle-executed migration. A different, separately approved Supabase-native execution path would be needed.

## Expected post-migration additions

The new Drizzle baseline includes 25 application tables, including `soapTemplates`, plus the identity-document changes required for safe registration: `id_document_type`, encrypted Passport columns, a Passport lookup hash, and a unique Passport hash index. The generated migration was corrected to create the `id_document_type` enum before adding the column.

## Explicit non-goals

- No migration is executed by this manifest.
- No database credentials, secrets, patient data, or PHI are recorded here.
- No commit, push, merge, or deployment is authorized by this reset decision.
