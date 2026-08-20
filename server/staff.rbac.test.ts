import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  countUsers: vi.fn(),
  createInitialAdmin: vi.fn(),
  createSession: vi.fn(),
  findUserByUsername: vi.fn(),
  recordLoginFailure: vi.fn(),
  recordLoginSuccess: vi.fn(),
  revokeSession: vi.fn(),
  listStaffAccounts: vi.fn(),
  createStaffAccount: vi.fn(),
  setStaffAccountActive: vi.fn(),
  updateStaffRole: vi.fn(),
}));

vi.mock("./db", () => database);

import { appRouter } from "./routers";

const systemAdmin = {
  id: 1,
  username: "platform-admin",
  passwordHash: "scrypt$131072$8$1$salt$hash",
  displayName: "ผู้ดูแลระบบ",
  role: "SYSTEM_ADMIN" as const,
  isActive: true,
  mustChangePassword: false,
  failedLoginCount: 0,
  lockedUntil: null,
  lastLoginAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function callerFor(user: typeof systemAdmin | { role: "DOCTOR" | "ASSISTANT"; id: number }) {
  return appRouter.createCaller({ user, req: { secure: true, headers: {} }, res: { cookie: vi.fn(), clearCookie: vi.fn() } } as never);
}

describe("staff management RBAC", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies doctors and assistants before any staff-account query executes", async () => {
    const clinicalUsers = [
      { ...systemAdmin, id: 2, role: "DOCTOR" as const },
      { ...systemAdmin, id: 3, role: "ASSISTANT" as const },
    ];

    for (const clinicalUser of clinicalUsers) {
      await expect(callerFor(clinicalUser).staff.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
    }

    expect(database.listStaffAccounts).not.toHaveBeenCalled();
  });

  it("returns only staff-account metadata to a system administrator", async () => {
    database.listStaffAccounts.mockResolvedValue([
      { id: 7, username: "assistant.one", displayName: "ผู้ช่วยหนึ่ง", role: "ASSISTANT", isActive: true, mustChangePassword: false, lastLoginAt: null, createdAt: new Date(), updatedAt: new Date() },
    ]);

    const result = await callerFor(systemAdmin).staff.list();

    expect(result).toEqual(expect.arrayContaining([expect.objectContaining({ username: "assistant.one", role: "ASSISTANT", isActive: true })]));
    expect(result[0]).not.toHaveProperty("passwordHash");
    expect(database.listStaffAccounts).toHaveBeenCalledOnce();
  });

  it("surfaces a conflict when a change would remove the final active system administrator", async () => {
    database.setStaffAccountActive.mockRejectedValue(new Error("LAST_ACTIVE_ADMIN"));

    await expect(callerFor(systemAdmin).staff.setActive({ userId: 9, isActive: false })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "ต้องคงผู้ดูแลระบบที่เปิดใช้งานอย่างน้อยหนึ่งบัญชี",
    });
  });

  it("rejects a weak initial password before persistence is queried", async () => {
    await expect(callerFor(systemAdmin).staff.create({
      username: "weak.password",
      displayName: "ทดสอบรหัสผ่าน",
      password: "alllowercase12",
      role: "ASSISTANT",
    })).rejects.toMatchObject({ code: "BAD_REQUEST", message: expect.stringContaining("อย่างน้อย 3 กลุ่ม") });
    expect(database.findUserByUsername).not.toHaveBeenCalled();
    expect(database.createStaffAccount).not.toHaveBeenCalled();
  });
});
