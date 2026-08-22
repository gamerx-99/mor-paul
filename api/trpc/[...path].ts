import "dotenv/config";
import { createApp } from "../../server/_core/app";

/**
 * Explicit Vercel Function entry for every tRPC procedure path. Keeping this
 * under api/trpc ensures the platform discovers a serverless function even
 * when Vite produces a static dist directory for the SPA.
 */
export default createApp();
