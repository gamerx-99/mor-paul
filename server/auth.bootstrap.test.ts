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

  it("accepts the configured one-time setup key without writing a real account during the test", async () => {
    const setupKey = process.env.INITIAL_SETUP_KEY;
    expect(setupKey).toBeTruthy();

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
      setupKey: setupKey!,
    });

    expect(result).toMatchObject({ username: "clinic-admin", role: "SYSTEM_ADMIN" });
    expect(database.createInitialAdmin).toHaveBeenCalledOnce();
    expect(database.createSession).toHaveBeenCalledOnce();
    expect(cookie).toHaveBeenCalledOnce();
  });
});
