# Deployment and Runtime Status — 2026-08-22

## GitHub and preview deployment

The identity-document release candidate was merged into GitHub `main` through pull request #1 after local `pnpm check`, `pnpm test`, `pnpm build`, and whitespace validation. The first Vercel preview failed because `vercel.json` specified `dist/public` while the Vite build emits `dist`. Commit `524a101` changed the output directory to `dist`, and the subsequent Vercel preview completed successfully before the merge.

## Runtime secret boundary

The Vercel project exposes only secret **names** to this review. Its visible environment-variable list contains `SESSION_SECRET`, `NATIONAL_ID_ENCRYPTION_KEY`, and Supabase URL/key variables. No secret value was opened, copied, logged, or placed in source control.

The deployed API is intended to use a server-only PostgreSQL `DATABASE_URL`; browser code must not receive it. The owner reported setting `DATABASE_URL` in Vercel and triggering a deployment. The Supabase project has already received the approved schema migrations. This record does not assert a working runtime connection until an aggregate-only check completes successfully.

Earlier in this review, an authenticated name-only search did not show `DATABASE_URL`. The owner subsequently reported correcting that configuration. Because the browser session used for verification is owner-controlled and secret values must remain undisclosed, the key must be rechecked by name only after the next successful deployment; the value must not be opened.

## Production routing incident

Production revision `b4593713ac04bf869a9bb79e2aa12570738e2f8a` was reachable but returned `500 MIDDLEWARE_INVOCATION_FAILED`. Source inspection identified a root-level Next/Supabase `middleware.ts` and its unused helpers. They are incompatible with this Vite/Express deployment and were still detected by Vercel as routing middleware. No application or patient route was reached, and no Vercel runtime logs were opened.

The release fix removes those unreachable Next middleware files and their obsolete barrel export. Local `pnpm check`, `pnpm test` (31 files / 120 tests), `pnpm build`, and whitespace validation pass after the change. A new deployment from `main` is required before rerunning runtime verification.

## Remaining release controls

- Merge the routing fix to GitHub `main` and verify Vercel deploys its resulting revision successfully.
- Verify `DATABASE_URL` by name and scope only in the owner-controlled Vercel UI; do not inspect its value.
- Verify an unauthenticated AccessGate response and `auth.setupStatus`, whose database work is a `count(users)` aggregate and whose response contains only booleans. Do not create or view patient data.
- Keep the RLS advisory discrepancy documented for an owner review; do not introduce client-side Supabase credentials or enable policies without a reviewed application authorization design.
