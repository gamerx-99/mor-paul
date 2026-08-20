import { createHash } from "node:crypto";
import type { Request } from "express";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const BLOCK_MS = 15 * 60 * 1000;

type Attempt = { count: number; windowStartedAt: number; blockedUntil: number | null };

const attempts = new Map<string, Attempt>();

function clientAddress(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  return value?.trim() || req.socket.remoteAddress || "unknown";
}

/** Hashes the account/IP tuple so raw IPs and usernames are never retained by this limiter. */
export function loginRateLimitKey(req: Request, normalizedUsername: string) {
  return createHash("sha256").update(`${clientAddress(req)}\u0000${normalizedUsername}`).digest("hex");
}

export function isLoginBlocked(key: string, now = Date.now()) {
  const attempt = attempts.get(key);
  if (!attempt) return false;
  if (attempt.blockedUntil && attempt.blockedUntil > now) return true;
  if (now - attempt.windowStartedAt > WINDOW_MS) attempts.delete(key);
  return false;
}

export function recordRateLimitedFailure(key: string, now = Date.now()) {
  const current = attempts.get(key);
  const resetWindow = !current || now - current.windowStartedAt > WINDOW_MS;
  const next: Attempt = resetWindow
    ? { count: 1, windowStartedAt: now, blockedUntil: null }
    : { ...current, count: current.count + 1 };
  if (next.count >= MAX_ATTEMPTS) next.blockedUntil = now + BLOCK_MS;
  attempts.set(key, next);
  return Boolean(next.blockedUntil && next.blockedUntil > now);
}

export function clearLoginRateLimit(key: string) {
  attempts.delete(key);
}

/** Test-only reset; this code path is not exposed by tRPC. */
export function resetLoginRateLimitsForTests() {
  attempts.clear();
}
