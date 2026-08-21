# Clinic HIS — System Architecture (Post-Migration)

>  refreshed from current source tree after MySQL→Postgres + Vercel migration.  
>  If anything conflicts with `docs/project-context/HANDOFF.md`, this file loses.

## Topology

```
┌───────────────────────────────────────────────────────┐
│  Browser (React 19 + Vite 7)                          │
│  client/src/ → /index.html → Vite dev/prod middleware │
└────────────────────────┬──────────────────────────────┘
                         │ same-origin HTTP
┌────────────────────────▼──────────────────────────────┐
│  Express 4 + tRPC 11                                  │
│  server/_core/app.ts → createApp()                    │
│  - /api/trpc      (tRPC router)                       │
│  - /api/health    (health check)                       │
│  - Vite HMR      (development only)                   │
│  - Static files   (production)                        │
└────────────────────────┬──────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
┌──────────────────┐        ┌───────────────────┐
│  Drizzle ORM      │        │  Supabase Storage  │
│  postgres-js      │        │  PHI bucket        │
│  drizzle/schema.ts│        │  server/storage.ts │
└──────────────────┘        └───────────────────┘
          │
          ▼
┌──────────────────────────────────────────┐
│  Supabase Postgres                        │
│  - Managed PostgreSQL instance           │
│  - Connection pooler (transaction mode)   │
│  - RLS enforced via supabase/migrations/  │
│  - 38 tables + 14 enums                   │
└──────────────────────────────────────────┘
```

## Runtime Modes

| Mode | Entry | Vite | DB |
|---|---|---|---|
| Development | `tsx watch server/_core/index.ts` | HMR enabled | local/test |
| Production | `tsx server/_core/index.ts` | static middleware | Supabase |
| Vercel | `api/[...path].ts → createApp()` | bundled | Supabase |

## Process Boundaries

- **Client process** — React SPA, no direct DB access, all mutations via tRPC
- **API process** — Express + tRPC, owns session cookies, RBAC, audit logging
- **Database** — Supabase Postgres, access only through `server/db.ts` + Drizzle
- **Storage** — Supabase Storage private bucket, accessed via `server/storage.ts`

## Security Boundaries

| Layer | Mechanism |
|---|---|
| Transport | HTTPS only in production; no HTTP in production |
| Auth | Local username/password + opaque session cookies (no OAuth) |
| RBAC | `server/_core/trpc.ts` procedures: `publicProcedure`, `assistantProcedure`, `doctorProcedure`, `clinicalReadProcedure` |
| PHI | `patients`, `clinicalNotes`, `visitDiagnoses`, etc. — only via `clinicalReadProcedure` |
| Audit | `server/auditContext.ts` — mutation logging with `safeAuditMetadata()` |
| DB | RLS enabled via `supabase/migrations/20260821014948_*.sql` |
| ID | National ID encrypted at rest, write-once, masked in UI/API |

## Ports

| Port | Service |
|---|---|
| 3000 | Express API + SPA (development) |
| Supabase pooler | 5432 (managed) |
| Vercel | auto-assigned |

## File Layout (key paths)

| Area | Path |
|---|---|
| Schema | `drizzle/schema.ts` |
| DB queries | `server/db.ts` |
| Routers | `server/routers/*.ts` |
| Auth | `server/localAuth.ts`, `server/loginRateLimit.ts` |
| Middleware | `middleware.ts` |
| Vercel entry | `api/[...path].ts` |
| Client entry | `client/src/main.tsx` |
| Pages | `client/src/pages/` |
| Supabase helpers | `lib/supabase/`, `utils/supabase/` |
