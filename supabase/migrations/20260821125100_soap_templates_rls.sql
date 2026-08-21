alter table public."soapTemplates" enable row level security;
revoke all on public."soapTemplates" from anon, authenticated;
