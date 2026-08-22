import { beforeEach, describe, expect, it, vi } from "vitest";

const testUser = {
  id: 1,
  username: "clinic-admin",
  passwordHash: "scrypt$131072$8$1$salt$hash",
  displayName: "ผู้ดูแลคลินิก",
  role: "SYSTEM_ADMIN" as const,
  isActive: true,
  mustChangePassword: false,
  failedLoginCount: 0,
  lockedUntil: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const database = vi.hoisted(() => ({
  countSystemAdmins: vi.fn(),
  countUsers: vi.fn(),
  createInitialAdmin: vi.fn(),
  createSession: vi.fn(),
  findUserByUsername: vi.fn(),
  recordLoginFailure: vi.fn(),
  recordLoginSuccess: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock("./db", () => database);

import { appRouter } from "./routers";

describe("auth.bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.createInitialAdmin.mockResolvedValue(testUser);
    database.createSession.mockResolvedValue(undefined);
    database.recordLoginSuccess.mockResolvedValue(undefined);
  });

  it("accepts valid credentials with valid setupKey", async () => {
    const cookie = vi.fn();
    const caller = appRouter.createCaller({
      user: null,
      req: { secure: true, headers: {} },
      res: { cookie, clearCookie: vi.fn() },
    } as never);

    const result = await caller.auth.bootstrap({
      username: "clinic-admin",
      password: "sufficiently-long-test-password",
      displayName: "ผู้ดูแลคลินิก",
      setupKey: "test-setup-key-with-sufficient-length",
    });

    expect(result).toMatchObject({ username: "clinic-admin", role: "SYSTEM_ADMIN" });
    expect(database.createInitialAdmin).toHaveBeenCalledOnce();
    expect(database.createSession).toHaveBeenCalledOnce();
    expect(cookie).toHaveBeenCalledOnce();
  });

  it("returns aggregate-only setup status without reading user records", async () => {
    database.countUsers.mockResolvedValue(0);
    const caller = appRouter.createCaller({
      user: null,
      req: { secure: true, headers: {} },
      res: { cookie: vi.fn(), clearCookie: vi.fn() },
    } as never);

    await expect(caller.auth.setupStatus()).resolves.toMatchObject({ requiresSetup: true });
    expect(database.countUsers).toHaveBeenCalledOnce();
    expect(database.findUserByUsername).not.toHaveBeenCalled();
  });

  it("maps readiness database failures to a safe message without query text", async () => {
    database.countUsers.mockRejectedValue(new Error('Failed query: select count(*) from "users"'));
    const caller = appRouter.createCaller({
      user: null,
      req: { secure: true, headers: {} },
      res: { cookie: vi.fn(), clearCookie: vi.fn() },
    } as never);

    await expect(caller.auth.setupStatus()).rejects.toThrow("ไม่สามารถตรวจสอบการตั้งค่าระบบได้ในขณะนี้");
    await expect(caller.auth.setupStatus()).rejects.not.toThrow(/select count/i);
  });

  it("rejects invalid setupKey with FORBIDDEN", async () => {
    const caller = appRouter.createCaller({
      user: null,
      req: { secure: true, headers: {} },
      res: { cookie: vi.fn(), clearCookie: vi.fn() },
    } as never);

    await expect(
      caller.auth.bootstrap({
        username: "clinic-admin",
        password: "sufficiently-long-test-password",
        displayName: "ผู้ดูแลคลินิก",
        setupKey: "wrong-setup-key-that-is-long-enough",
      })
    ).rejects.toThrow("รหัสตั้งค่าระบบไม่ถูกต้อง");
    expect(database.createInitialAdmin).not.toHaveBeenCalled();
  });

  it("rejects when bootstrap is closed with CONFLICT", async () => {
    database.createInitialAdmin.mockRejectedValue(new Error("BOOTSTRAP_CLOSED"));
    const caller = appRouter.createCaller({
      user: null,
      req: { secure: true, headers: {} },
      res: { cookie: vi.fn(), clearCookie: vi.fn() },
    } as never);

    await expect(
      caller.auth.bootstrap({
        username: "clinic-admin",
        password: "sufficiently-long-test-password",
        displayName: "ผู้ดูแลคลินิก",
        setupKey: "test-setup-key-with-sufficient-length",
      })
    ).rejects.toThrow("ระบบมีบัญชีผู้ดูแลแล้ว");
  });
});
