# Clinic HIS — Database Specification

> Generated from current `drizzle/schema.ts` after Postgres migration.  
> If `drizzle/schema.ts` changes, regenerate this file.

## Engine

- PostgreSQL via Supabase managed instance
- Driver: `postgres-js` (`postgres` package)
- ORM: Drizzle ORM, dialect `postgresql`
- Migrations: `drizzle/migrations/`
- Migrations journal: `drizzle/meta/_journal.json`
- Schema snapshot: `drizzle/meta/0006_snapshot.json`

## Connection

- `server/db.ts` manages connection through Drizzle
- `.env` must not contain `DATABASE_URL` or `POSTGRES_URL` in this tree; Supabase connection is configured through deployment environment
- In development: local Postgres or Supabase remote via env
- In production: Supabase pooler in transaction mode

## Enums (14)

| Enum | Values |
|---|---|
| `user_role` | `SYSTEM_ADMIN`, `DOCTOR`, `ASSISTANT` |
| `patient_gender` | `MALE`, `FEMALE`, `OTHER`, `UNSPECIFIED` |
| `visit_status` | `REGISTERED`, `TRIAGED`, `WAITING_DOCTOR`, `IN_CONSULT`, `DISPENSING`, `BILLED`, `CLOSED`, `CANCELLED` |
| `triage_urgency` | `ROUTINE`, `PRIORITY`, `URGENT` |
| `queue_status` | `WAITING`, `CALLED`, `IN_CONSULT`, `COMPLETED`, `CANCELLED` |
| `clinical_note_status` | `DRAFT`, `SIGNED` |
| `clinical_order_status` | `DRAFT`, `SIGNED`, `CANCELLED` |
| `dispensation_status` | `PENDING`, `COMPLETED`, `VOIDED` |
| `stock_movement_type` | `RECEIVE`, `DISPENSE`, `ADJUST`, `RETURN`, `VOID` |
| `invoice_status` | `DRAFT`, `ISSUED`, `PAID`, `VOID` |
| `service_charge_status` | `PENDING`, `INVOICED`, `VOID` |
| `payment_method` | `CASH`, `PROMPTPAY`, `EXTERNAL_REFERENCE`, `CREDIT_CARD` |
| `audit_outcome` | `ALLOWED`, `DENIED`, `FAILED` |
| `soap_template_service_type` | (defined in schema; used by `soapTemplates`) |

## Tables (38)

### Clinical Core

| Table | Purpose |
|---|---|
| `users` | Clinic staff accounts (SYSTEM_ADMIN, DOCTOR, ASSISTANT) |
| `patients` | Patient master; national ID encrypted, write-once, masked in UI |
| `visits` | Patient visits/encounters; FK to patient, date, status |
| `triageRecords` | Per-visit triage vitals + urgency |
| `queueEntries` | Daily queue; unique per visit, auto-numbered |
| `clinicalNotes` | SOAP draft per visit; signing locks narrative |
| `clinicalPresets` | Doctor personal SOAP templates |
| `soapTemplates` | Shared SOAP templates by service type |
| `visitDiagnoses` | Diagnosis per visit (ranked) |
| `clinicalOrders` | Doctor orders per visit (DRAFT/SIGNED/CANCELLED) |

### Pharmacy

| Table | Purpose |
|---|---|
| `medications` | Medication catalog; active/inactive flag |
| `medicationPrices` | Versioned unit prices (satang); invoices snapshot |
| `inventoryLots` | Physical stock lots with remainingQuantity |
| `stockMovements` | Append-only stock movement log |
| `dispensations` | Per-visit dispensation header |
| `dispensationItems` | Items within a dispensation |

### Finance

| Table | Purpose |
|---|---|
| `invoices` | Invoice header per visit |
| `invoiceLines` | Line items (service charges, medication) |
| `payments` | Payment records with idempotency key |
| `serviceCharges` | Service charge per visit; status-driven |

### Operations

| Table | Purpose |
|---|---|
| `userSessions` | Opaque session tokens (hashed), TTL, revocation |
| `auditEvents` | PHI-safe audit log; input payload omitted |
| `dailyCloseouts` | End-of-day financial closure |
| `loginFailures` | Rate-limited login tracking |

## Key Constraints

- `patients.nationalIdLookupHash` unique (write-once)
- `queueEntries` unique per `(queueDate, queueNumber)`
- `userSessions.tokenHash` unique
- `clinicalNotes` / `clinicalOrders` / `dispensations` / `invoices` unique per `visitId`
- Payments use idempotency key to prevent double-charge
- Invoice lines snapshot `unitPriceSatang` at billing time; never reread price table

## Indexes

- `visits_patient_idx` on `visits(patientId)`
- `visits_date_status_idx` on `visits(visitDate, status)`
- `queue_date_number_unique` on `queueEntries(queueDate, queueNumber)`
- `queue_date_status_idx` on `queueEntries(queueDate, status)`
- `patients_name_idx` on `patients(lastName, firstName)`
- `patients_national_id_hash_unique` on `patients(nationalIdLookupHash)`
- `medications_active_name_idx` on `medications(isActive, genericName)`
- `medication_prices_lookup_idx` on `medicationPrices(medicationId, isActive, effectiveFrom)`
- `triage_performed_at_idx` on `triageRecords(performedAt)`
- `visit_diagnoses_visit_idx` on `visitDiagnoses(visitId)`
- `service_charges_visit_status_idx` on `serviceCharges(visitId, status)`

## Row Level Security

Enabled via `supabase/migrations/20260821014948_secure_clinical_tables.sql` and `supabase/migrations/20260821125100_soap_templates_rls.sql`.  
Service role bypasses RLS (use only server-side). Client access is strictly via tRPC RBAC.

## PHI Protection

- `patients.nationalIdCiphertext` / `nationalIdLookupHash` — encrypted at rest, masked in API/UI
- `auditEvents.metadata` — sanitized via `safeAuditMetadata()`; no PHI fields
- `SYSTEM_ADMIN` — zero-PHI role; cannot read clinical notes, diagnoses, national ID, or patient contact
