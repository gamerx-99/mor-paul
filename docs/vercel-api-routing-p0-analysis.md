# Vercel API Routing P0 Analysis — 2026-08-22

## Scope

This note records deployment-routing evidence only. No patient record, clinical data, database secret, or runtime log content is included.

## Evidence

| Item | Observed result |
| --- | --- |
| GitHub production revision | `af075ffdd9ba2350284e62405872b15928c9a927` |
| Browser request to `GET /api/trpc/auth.setupStatus` | Vercel `404: NOT_FOUND`; the request did not reach Express/tRPC. |
| Public request without Vercel SSO | Redirected to Deployment Protection SSO, as expected. |
| Current Vercel configuration | Static Vite build with `outputDirectory: dist`; no API rewrite is configured. |
| Current function entry | `api/[...path].ts` exports the Express application from `server/_core/app`. |

## Interpretation

The browser-side `404` occurs at Vercel routing before the intended aggregate-only readiness procedure can run. It is therefore not evidence that `DATABASE_URL` succeeds or fails. The issue must be repaired and redeployed before using `auth.setupStatus` as the metadata-only PostgreSQL verification.

Vercel’s current documentation states that functions for non-framework applications are defined under `/api`, while Express applications are auto-detected from supported root or `src/` entry-point locations. The present project uses a Vite static output plus an API catch-all entry that was not routed in production. The P0 remediation adds the supported root `server.ts` entry exporting the existing Express app and removes the non-routable catch-all file. This preserves the static Vite output while routing non-static requests, including `/api/trpc`, through the existing app contract.

## Sources

- [Vercel Functions API Reference](https://vercel.com/docs/functions/functions-api-reference), accessed 2026-08-22.
- [Vercel: Express on Vercel](https://vercel.com/docs/frameworks/backend/express), accessed 2026-08-22.
- [Vercel: Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), accessed 2026-08-22.
- [Vercel: Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js), accessed 2026-08-22.

## Next verification

After the routing fix is deployed, call only `GET /api/trpc/auth.setupStatus?input={"json":null}` through the authenticated deployment. This procedure uses an aggregate count and returns a boolean; it must not create or retrieve PHI.
