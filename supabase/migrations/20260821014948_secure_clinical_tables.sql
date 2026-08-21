-- The browser uses the same-origin tRPC API only.  Lock down the exposed
-- public schema so a publishable/anon key cannot read clinical data directly.
alter table public."users" enable row level security;
alter table public."userSessions" enable row level security;
alter table public."patients" enable row level security;
alter table public."visits" enable row level security;
alter table public."triageRecords" enable row level security;
alter table public."queueEntries" enable row level security;
alter table public."clinicalNotes" enable row level security;
alter table public."visitDiagnoses" enable row level security;
alter table public."medications" enable row level security;
alter table public."medicationPrices" enable row level security;
alter table public."inventoryLots" enable row level security;
alter table public."clinicalOrders" enable row level security;
alter table public."medicationOrderItems" enable row level security;
alter table public."dispensations" enable row level security;
alter table public."dispensationItems" enable row level security;
alter table public."stockMovements" enable row level security;
alter table public."invoices" enable row level security;
alter table public."serviceCharges" enable row level security;
alter table public."invoiceLines" enable row level security;
alter table public."payments" enable row level security;
alter table public."invoiceVoids" enable row level security;
alter table public."dailyCloseouts" enable row level security;
alter table public."auditEvents" enable row level security;
alter table public."clinicalPresets" enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
