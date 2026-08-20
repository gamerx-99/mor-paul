import type { Express } from "express";

/** Local staff accounts authenticate via the same-origin form, not an OAuth redirect. */
export function registerOAuthRoutes(_app: Express) {}
