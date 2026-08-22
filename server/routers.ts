import { TRPCError } from "@trpc/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { changeOwnPassword, countUsers, createInitialAdmin, createSession, findUserByUsername, recordLoginFailure, recordLoginSuccess, recordLogout, recordPasswordChangeDenied, revokeSession, type AuditContext } from "./db";
import { createSessionToken, hashPassword, hashSessionToken, isStrongPassword, isValidUsername, LOCAL_SESSION_COOKIE, matchesSetupKey, normalizeUsername, sessionCookieOptions, SESSION_TTL_MS, toPublicUser, verifyPassword } from "./localAuth";
import { clearLoginRateLimit, isLoginBlocked, loginRateLimitKey, recordRateLimitedFailure } from "./loginRateLimit";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { doctorConsoleRouter } from "./routers/doctorConsole";
import { frontDeskRouter } from "./routers/frontDesk";
import { pharmacyRouter } from "./routers/pharmacy";
import { reportsRouter } from "./routers/reports";
import { staffRouter } from "./routers/staff";

const credentialInput = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(12).max(128),
});

function denyLogin() {
  throw new TRPCError({ code: "UNAUTHORIZED", message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
}

function auditFor(user: { id: number; role: AuditContext["actorRole"] }): AuditContext {
  return { actorUserId: user.id, actorRole: user.role, requestId: randomUUID() };
}

function sessionTokenFromRequest(cookieHeader: string | undefined) {
  return cookieHeader?.match(new RegExp(`(?:^|;\\s*)${LOCAL_SESSION_COOKIE}=([^;]+)`))?.[1];
}

async function issueSession(ctx: { req: Parameters<typeof sessionCookieOptions>[0]; res: { cookie: (name: string, value: string, options: ReturnType<typeof sessionCookieOptions>) => unknown } }, userId: number) {
  const token = createSessionToken();
  await createSession(userId, hashSessionToken(token), new Date(Date.now() + SESSION_TTL_MS));
  ctx.res.cookie(LOCAL_SESSION_COOKIE, token, sessionCookieOptions(ctx.req));
}

export const appRouter = router({
  system: systemRouter,
  frontDesk: frontDeskRouter,
  doctorConsole: doctorConsoleRouter,
  pharmacy: pharmacyRouter,
  reports: reportsRouter,
  staff: staffRouter,
  auth: router({
    setupStatus: publicProcedure.query(async () => {
      try {
        return { requiresSetup: (await countUsers()) === 0, setupEnabled: Boolean(process.env.INITIAL_SETUP_KEY) };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ไม่สามารถตรวจสอบการตั้งค่าระบบได้ในขณะนี้" });
      }
    }),
    me: publicProcedure.query(({ ctx }) => (ctx.user ? toPublicUser(ctx.user) : null)),
    bootstrap: publicProcedure
      .input(credentialInput.extend({ displayName: z.string().trim().min(2).max(120), setupKey: z.string().min(16).max(256) }))
      .mutation(async ({ ctx, input }) => {
        const username = normalizeUsername(input.username);
        if (!isValidUsername(username)) throw new TRPCError({ code: "BAD_REQUEST", message: "ชื่อผู้ใช้ใช้ a-z, 0-9, จุด, ขีดกลาง หรือขีดล่างได้ 3–32 ตัว" });
        if (!matchesSetupKey(input.setupKey, process.env.INITIAL_SETUP_KEY ?? "")) throw new TRPCError({ code: "FORBIDDEN", message: "รหัสตั้งค่าระบบไม่ถูกต้อง" });
        try {
          const user = await createInitialAdmin({ username, displayName: input.displayName, passwordHash: await hashPassword(input.password) });
          await recordLoginSuccess(user.id, auditFor(user));
          await issueSession(ctx, user.id);
          return toPublicUser(user);
        } catch (error) {
          if (error instanceof Error && error.message === "BOOTSTRAP_CLOSED") throw new TRPCError({ code: "CONFLICT", message: "ระบบมีบัญชีผู้ดูแลแล้ว" });
          throw error;
        }
      }),
    login: publicProcedure.input(credentialInput).mutation(async ({ ctx, input }) => {
      const username = normalizeUsername(input.username);
      const rateLimitKey = loginRateLimitKey(ctx.req, username);
      if (isLoginBlocked(rateLimitKey)) denyLogin();
      const user = await findUserByUsername(username);
      if (!user || !user.isActive || (user.lockedUntil && user.lockedUntil > new Date())) {
        recordRateLimitedFailure(rateLimitKey);
        denyLogin();
      }
      if (!(await verifyPassword(input.password, user.passwordHash))) {
        await recordLoginFailure(user, auditFor(user));
        recordRateLimitedFailure(rateLimitKey);
        denyLogin();
      }
      clearLoginRateLimit(rateLimitKey);
      await recordLoginSuccess(user.id, auditFor(user));
      await issueSession(ctx, user.id);
      return toPublicUser(user);
    }),
    changePassword: protectedProcedure
      .input(z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128) }))
      .mutation(async ({ ctx, input }) => {
        const audit = auditFor(ctx.user);
        if (!isStrongPassword(input.newPassword)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "รหัสผ่านใหม่ต้องยาวอย่างน้อย 12 ตัวอักษร และหากสั้นกว่า 16 ตัวอักษรต้องมีอย่างน้อย 3 ประเภทอักขระ" });
        }
        if (input.currentPassword === input.newPassword) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน" });
        }
        if (!(await verifyPassword(input.currentPassword, ctx.user.passwordHash))) {
          await recordPasswordChangeDenied(audit);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "ตรวจสอบรหัสผ่านปัจจุบันอีกครั้ง" });
        }
        const rawToken = sessionTokenFromRequest(ctx.req.headers.cookie);
        await changeOwnPassword({
          userId: ctx.user.id,
          passwordHash: await hashPassword(input.newPassword),
          currentSessionTokenHash: rawToken ? hashSessionToken(rawToken) : undefined,
          audit,
        });
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      const rawCookie = sessionTokenFromRequest(ctx.req.headers.cookie);
      if (rawCookie) await revokeSession(hashSessionToken(rawCookie));
      if (ctx.user) await recordLogout(auditFor(ctx.user));
      ctx.res.clearCookie(LOCAL_SESSION_COOKIE, sessionCookieOptions(ctx.req, 0));
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
