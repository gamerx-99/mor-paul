import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import type { CookieOptions, Request } from "express";
import type { User } from "../drizzle/schema";

const SCRYPT_N = 2 ** 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 32;
const MAX_MEMORY = 256 * 1024 * 1024;

export const LOCAL_SESSION_COOKIE = "clinic_session";
export const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

export type PublicUser = Pick<User, "id" | "username" | "displayName" | "role" | "mustChangePassword" | "lastLoginAt"> & { name: string; email: null };

function deriveScryptKey(password: string, salt: Buffer, keyLength: number, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, { N, r, p, maxmem: MAX_MEMORY }, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(Buffer.from(derivedKey));
    });
  });
}

export function normalizeUsername(input: string) {
  return input.trim().toLowerCase();
}

export function isValidUsername(input: string) {
  return /^[a-z0-9._-]{3,32}$/.test(input);
}

/** A long passphrase is allowed; shorter passwords must contain three character classes. */
export function isStrongPassword(password: string) {
  if (password.length < 12 || password.length > 128) return false;
  if (password.length >= 16) return true;
  const classes = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^\w\s]/.test(password)].filter(Boolean).length;
  return classes >= 3;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const derived = await deriveScryptKey(password, salt, KEY_LENGTH, SCRYPT_N, SCRYPT_R, SCRYPT_P);

  return ["scrypt", SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString("base64url"), derived.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, encoded: string) {
  const [algorithm, nValue, rValue, pValue, saltValue, expectedValue] = encoded.split("$");
  if (algorithm !== "scrypt" || !nValue || !rValue || !pValue || !saltValue || !expectedValue) return false;

  const N = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p) || N < SCRYPT_N || r < SCRYPT_R || p < SCRYPT_P) return false;

  try {
    const salt = Buffer.from(saltValue, "base64url");
    const expected = Buffer.from(expectedValue, "base64url");
    const actual = await deriveScryptKey(password, salt, expected.length, N, r, p);
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function createSessionToken() {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionCookieOptions(req: Request, maxAge = SESSION_TTL_MS): CookieOptions {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const isHttps = req.secure || (typeof forwardedProto === "string" && forwardedProto.split(",")[0]?.trim() === "https");
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge,
  };
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    name: user.displayName,
    email: null,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt: user.lastLoginAt,
  };
}

export function matchesSetupKey(submitted: string, expected: string) {
  const submittedBuffer = Buffer.from(submitted);
  const expectedBuffer = Buffer.from(expected);
  return Boolean(expected) && submittedBuffer.length === expectedBuffer.length && timingSafeEqual(submittedBuffer, expectedBuffer);
}
