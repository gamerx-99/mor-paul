import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { resetLoginRateLimitsForTests } from "./loginRateLimit";

const testUser = {
  id: 7,
  username: "clinic.assistant",
  passwordHash: "stored-password-hash",
  displayName: "ผู้ช่วยทดสอบ",
  role: "ASSISTANT" as const,
  isActive: true,
  mustChangePassword: false,
  failedLoginCount: 0,
  lockedUntil: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const database = vi.hoisted(() => ({
  changeOwnPassword: vi.fn(),
  countUsers: vi.fn(),
  createInitialAdmin: vi.fn(),
  createSession: vi.fn(),
  findUserByUsername: vi.fn(),
  recordLoginFailure: vi.fn(),
  recordLoginSuccess: vi.fn(),
  recordLogout: vi.fn(),
  recordPasswordChangeDenied: vi.fn(),
  revokeSession: vi.fn(),
}));

const authCrypto = vi.hoisted(() => ({
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

vi.mock("./db", () => database);
vi.mock("./localAuth", async importOriginal => ({
  ...(await importOriginal<typeof import("./localAuth")>()),
  hashPassword: authCrypto.hashPassword,
  verifyPassword: authCrypto.verifyPassword,
}));

import { appRouter } from "./routers";

function authenticatedCaller(cookie = "clinic_session=current-raw-token") {
  return appRouter.createCaller({
    user: testUser,
    req: { secure: true, headers: { cookie }, socket: { remoteAddress: "127.0.0.1" } },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
  } as never);
}

function publicCaller() {
  return appRouter.createCaller({
    user: null,
    req: { secure: true, headers: {}, socket: { remoteAddress: "127.0.0.1" } },
    res: { cookie: vi.fn(), clearCookie: vi.fn() },
  } as never);
}

describe("auth hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLoginRateLimitsForTests();
    authCrypto.hashPassword.mockResolvedValue("new-password-hash");
    database.changeOwnPassword.mockResolvedValue(undefined);
    database.recordPasswordChangeDenied.mockResolvedValue(undefined);
    database.recordLoginFailure.mockResolvedValue(undefined);
    database.recordLoginSuccess.mockResolvedValue(undefined);
    database.createSession.mockResolvedValue(undefined);
  });

  it("changes a password only after verifying the current password and preserves the current session hash", async () => {
    authCrypto.verifyPassword.mockResolvedValue(true);

    const result = await authenticatedCaller().auth.changePassword({
      currentPassword: "current-password",
      newPassword: "New!Password2026",
    });

    expect(result).toEqual({ success: true });
    expect(database.changeOwnPassword).toHaveBeenCalledWith(expect.objectContaining({
      userId: testUser.id,
      passwordHash: "new-password-hash",
      currentSessionTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      audit: expect.objectContaining({ actorUserId: testUser.id, actorRole: "ASSISTANT" }),
    }));
  });

  it("denies a password change with an incorrect current password and records a secret-free audit event", async () => {
    authCrypto.verifyPassword.mockResolvedValue(false);

    await expect(authenticatedCaller().auth.changePassword({
      currentPassword: "incorrect-current-password",
      newPassword: "New!Password2026",
    })).rejects.toMatchObject<Partial<TRPCError>>({ code: "UNAUTHORIZED", message: "ตรวจสอบรหัสผ่านปัจจุบันอีกครั้ง" });

    expect(database.recordPasswordChangeDenied).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: testUser.id, actorRole: "ASSISTANT" }));
    expect(database.changeOwnPassword).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated access to password change before password verification or database work", async () => {
    await expect(publicCaller().auth.changePassword({
      currentPassword: "current-password",
      newPassword: "New!Password2026",
    })).rejects.toMatchObject<Partial<TRPCError>>({ code: "UNAUTHORIZED", message: "Please login (10001)" });

    expect(authCrypto.verifyPassword).not.toHaveBeenCalled();
    expect(database.changeOwnPassword).not.toHaveBeenCalled();
  });

  it("applies a generic local rate limit before further account lookup after repeated failures", async () => {
    database.findUserByUsername.mockResolvedValue(null);
    const caller = publicCaller();
    const input = { username: "not-a-real-account", password: "long-enough-password" };

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await expect(caller.auth.login(input)).rejects.toMatchObject<Partial<TRPCError>>({ code: "UNAUTHORIZED", message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }
    await expect(caller.auth.login(input)).rejects.toMatchObject<Partial<TRPCError>>({ code: "UNAUTHORIZED", message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });

    expect(database.findUserByUsername).toHaveBeenCalledTimes(10);
  });

  it("records successful local login through the audit-aware helper without exposing password fields", async () => {
    database.findUserByUsername.mockResolvedValue(testUser);
    authCrypto.verifyPassword.mockResolvedValue(true);

    await publicCaller().auth.login({ username: testUser.username, password: "valid-long-password" });

    expect(database.recordLoginSuccess).toHaveBeenCalledWith(testUser.id, expect.objectContaining({ actorUserId: testUser.id, actorRole: "ASSISTANT" }));
  });
});
