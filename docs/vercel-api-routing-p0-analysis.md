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
| Production routing repair revision | GitHub merge commit `d6947f44dbeb0e99b0f6eee593237fc6720b6991`; Vercel deployment `6037136273` was marked `success` with revision URL `https://mor-paul-p25qvyork-gamerx-99s-projects.vercel.app`. |
| Browser request after root-server remediation | The production login shell loaded, but `GET /api/trpc/auth.setupStatus` still returned Vercel `404: NOT_FOUND`; the request did not reach Express/tRPC. |

## Interpretation

The browser-side `404` occurs at Vercel routing before the intended aggregate-only readiness procedure can run. It is therefore not evidence that `DATABASE_URL` succeeds or fails. The issue must be repaired and redeployed before using `auth.setupStatus` as the metadata-only PostgreSQL verification.

Vercel’s current documentation states that functions for non-framework applications are defined under `/api`, while Express applications are auto-detected from supported root or `src/` entry-point locations. The present project uses a Vite static output plus an API catch-all entry that was not routed in production. The P0 remediation adds the supported root `server.ts` entry exporting the existing Express app and removes the non-routable catch-all file. This preserves the static Vite output while routing non-static requests, including `/api/trpc`, through the existing app contract.

The first production verification showed that the platform still did not publish an API route. Static delivery works, but the root server entry alone is insufficient in this project configuration. The next repair must explicitly configure a Vercel Function route; runtime/database health remains unverified until the aggregate-only route returns successfully.

## Vendor documentation consulted

Vercel's official Express guide (updated 2026-07-06) states that a root `server.ts` file with a default Express export is a supported function entry point, and that an Express deployment is a single Vercel Function. The official rewrites guide (updated 2026-07-01) documents `source`/`destination` rules and named catch-all patterns such as `/api/:path*`. These sources support using an explicit function under `api/` plus a same-project rewrite when the Vite static deployment does not discover the root server entry.

Sources: <https://vercel.com/docs/frameworks/backend/express> and <https://vercel.com/docs/routing/rewrites>.

## Follow-up route repair

The root Express entry and the generic `api/[...path].ts` entry were not published as a callable function in the static Vite deployment. The P0 follow-up therefore adds the concrete filesystem route `api/trpc/[...path].ts`. It exports the same shared `createApp()` instance, so the existing Express `/api/trpc` mount and RBAC contracts are unchanged. The TypeScript function uses Vercel's default Node runtime; a custom runtime declaration was deliberately removed after Vercel rejected its version format during preview deployment. The next Vercel preview must demonstrate a callable `auth.setupStatus` response before this item can be closed.

## Sources

- [Vercel Functions API Reference](https://vercel.com/docs/functions/functions-api-reference), accessed 2026-08-22.
- [Vercel: Express on Vercel](https://vercel.com/docs/frameworks/backend/express), accessed 2026-08-22.
- [Vercel: Vite on Vercel](https://vercel.com/docs/frameworks/frontend/vite), accessed 2026-08-22.
- [Vercel: Node.js runtime](https://vercel.com/docs/functions/runtimes/node-js), accessed 2026-08-22.

## Next verification

After the routing fix is deployed, call only `GET /api/trpc/auth.setupStatus?input={"json":null}` through the authenticated deployment. This procedure uses an aggregate count and returns a boolean; it must not create or retrieve PHI.

## Follow-up: Vercel function packaging

The readiness-only invocation reached the explicit tRPC route, but the Vercel runtime reported `ERR_MODULE_NOT_FOUND` for the emitted function's import of `server/_core/app`. The remediation moves the source handler to `api/trpc/handler.ts` and bundles it during the Vercel build into the deployed `api/trpc/[...path].js` catch-all artifact. This preserves the Express/tRPC contract while removing a runtime dependency on source files that Vercel did not package. No secrets, PHI, or production records were used in this analysis.

The generated catch-all artifact is now kept in source control so Vercel discovers the function before its static build runs; the build command regenerates the same artifact from `api/trpc/handler.ts`. A regression test verifies that the committed artifact exists and does not retain a source-only import of `server/_core/app`.

The first bundled production invocation also showed that `dotenv/config` pulls a dynamic `fs` require into the ESM function artifact, which Vercel rejects before the route handler runs. Because Vercel injects environment variables directly, the Vercel-only handler removes that local-development bootstrap. The same regression test rejects a generated artifact containing `dotenv/config`.

The next production invocation showed that Express's CommonJS dependency chain performs dynamic built-in imports such as `path`, which the ESM bundle shim rejects. The remediation keeps the Vercel-discovered catch-all entry as a minimal ESM wrapper and bundles the Express/tRPC source `entry-source.ts` as `handler.cjs`. This lets Node execute the CommonJS dependency chain natively while preserving the same Express application and endpoint contract. The distinct source/artifact basenames also avoid Vercel's extension-insensitive path conflict.
