import { createExpressMiddleware } from "@trpc/server/adapters/express";
import express from "express";
import { appRouter } from "../routers";
import { createContext } from "./context";

/**
 * Shared HTTP application for local development and Vercel Functions.
 *
 * Keep all clinical workflows behind this same-origin API.  The browser never
 * receives the database URL or a Supabase service-role key.
 */
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  return app;
}
