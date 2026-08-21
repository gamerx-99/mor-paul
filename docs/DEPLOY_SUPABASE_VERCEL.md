# Supabase + Vercel deployment

This application keeps clinical operations behind the same-origin tRPC API. Vercel hosts the Vite client and the `api/[...path]` Node Function; the function accesses Supabase Postgres with Drizzle. No browser code receives `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, or the national-ID encryption key.

## 1. Prepare Supabase

1. In Supabase, create a project in the required data-residency region.
2. In **Connect**, copy the **Transaction pooler** connection string (port `6543`) into `DATABASE_URL`. Vercel functions are short-lived, so this pooler is required. The application disables prepared statements for this connection mode.
3. Apply the initial PostgreSQL schema from `drizzle/migrations/0000_stale_boomer.sql` with `pnpm drizzle-kit migrate` while `DATABASE_URL` points at the Supabase project. Do not apply the older MySQL files directly under `drizzle/`.
4. Apply `supabase/migrations/20260821014948_secure_clinical_tables.sql` through the Supabase CLI or SQL Editor after the schema has been created. It enables RLS and revokes Data API access from browser roles.
5. Set `NATIONAL_ID_ENCRYPTION_KEY` to a unique base64 32-byte key and retain it securely. Losing it makes encrypted national IDs unreadable.
6. If server uploads are enabled, create the private `clinic-private` Storage bucket and set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`.

The client does not access clinic tables through the Supabase Data API. If those tables are exposed in the `public` schema, enable RLS and do not add permissive `anon` or `authenticated` policies; requests must go through the authenticated tRPC API.

## 2. Deploy to Vercel

1. Import this repository in Vercel.
2. Add the variables in `.env.example` to **Production**, **Preview**, and **Development** as appropriate. Keep every secret server-only.
3. Deploy. `vercel.json` builds the client to `dist`, sends `/api/*` to the serverless function, and rewrites remaining routes to the SPA entry point.
4. Open the deployed URL, bootstrap the first local administrator once using `LOCAL_AUTH_SETUP_KEY`, then remove that setup key from Vercel.

For Vercel preview deployments, use a separate Supabase project or separate non-production database credentials. Never point Preview at production patient data.
