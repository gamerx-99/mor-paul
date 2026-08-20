import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { parse as parseCookie } from "cookie";
import type { User } from "../../drizzle/schema";
import { findActiveSessionUser } from "../db";
import { hashSessionToken, LOCAL_SESSION_COOKIE } from "../localAuth";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    const cookies = parseCookie(opts.req.headers.cookie ?? "");
    const token = cookies[LOCAL_SESSION_COOKIE];
    if (token) user = await findActiveSessionUser(hashSessionToken(token));
  } catch {
    // Public procedures must remain reachable when a stale or invalid session is presented.
    user = null;
  }
  return { req: opts.req, res: opts.res, user };
}
