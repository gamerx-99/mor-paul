import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({ recordLogout: vi.fn() }));

vi.mock("./db", () => database);

import { appRouter } from "./routers";
import { LOCAL_SESSION_COOKIE } from "./localAuth";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    username: "sample-user",
    passwordHash: "scrypt$131072$8$1$salt$hash",
    displayName: "Sample User",
    role: "ASSISTANT",
    isActive: true,
    mustChangePassword: false,
    failedLoginCount: 0,
    lockedUntil: null,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: { "x-forwarded-proto": "https" },
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    database.recordLogout.mockResolvedValue(undefined);
  });

  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(LOCAL_SESSION_COOKIE);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: 0,
      secure: true,
      sameSite: "lax",
      httpOnly: true,
      path: "/",
    });
    expect(database.recordLogout).toHaveBeenCalledOnce();
    expect(database.recordLogout).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: 1, actorRole: "ASSISTANT" }));
  });
});
