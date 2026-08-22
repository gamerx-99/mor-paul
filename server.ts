import "dotenv/config";
import { createApp } from "./server/_core/app";

/**
 * Vercel detects a root server entry for the Node.js runtime.  Exporting the
 * existing Express app keeps the static Vite output on the platform CDN while
 * all non-static requests, including /api/trpc, reach the same application
 * contract used in local development.
 */
const app = createApp();

export default app;
