import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createStaffAccount, findUserByUsername, listStaffAccounts, setStaffAccountActive, type AuditContext, updateStaffRole } from "../db";
import { hashPassword, isStrongPassword, isValidUsername, normalizeUsername } from "../localAuth";
import { adminProcedure, router } from "../_core/trpc";

const staffRole = z.enum(["SYSTEM_ADMIN", "DOCTOR", "ASSISTANT"]);

function auditFor(user: { id: number; role: AuditContext["actorRole"] }): AuditContext {
  return { actorUserId: user.id, actorRole: user.role, requestId: randomUUID() };
}

function throwMappedStaffError(error: unknown): never {
  const code = error instanceof Error ? error.message : "";
  if (code === "STAFF_ACCOUNT_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบบัญชีบุคลากร" });
  if (code === "LAST_ACTIVE_ADMIN") throw new TRPCError({ code: "CONFLICT", message: "ต้องคงผู้ดูแลระบบที่เปิดใช้งานอย่างน้อยหนึ่งบัญชี" });
  if (code === "SELF_ACCOUNT_CHANGE_NOT_ALLOWED") throw new TRPCError({ code: "FORBIDDEN", message: "ไม่อนุญาตให้ปิดใช้หรือเปลี่ยนบทบาทบัญชีของตนเองจากหน้านี้" });
  throw error;
}

export const staffRouter = router({
  list: adminProcedure.query(() => listStaffAccounts()),
  create: adminProcedure
    .input(z.object({ username: z.string().min(3).max(32), displayName: z.string().trim().min(2).max(120), password: z.string().min(12).max(128), role: staffRole }))
    .mutation(async ({ ctx, input }) => {
      const username = normalizeUsername(input.username);
      if (!isValidUsername(username)) throw new TRPCError({ code: "BAD_REQUEST", message: "ชื่อผู้ใช้ใช้ a-z, 0-9, จุด, ขีดกลาง หรือขีดล่างได้ 3–32 ตัว" });
      if (!isStrongPassword(input.password)) throw new TRPCError({ code: "BAD_REQUEST", message: "รหัสผ่านต้องยาว 12–128 ตัวอักษร และหากสั้นกว่า 16 ตัว ต้องมีอย่างน้อย 3 กลุ่ม: ตัวพิมพ์เล็ก ตัวพิมพ์ใหญ่ ตัวเลข หรืออักขระพิเศษ" });
      if (await findUserByUsername(username)) throw new TRPCError({ code: "CONFLICT", message: "ชื่อผู้ใช้นี้ถูกใช้แล้ว" });
      try {
        return await createStaffAccount({ username, displayName: input.displayName, passwordHash: await hashPassword(input.password), role: input.role }, auditFor(ctx.user));
      } catch (error) {
        throwMappedStaffError(error);
      }
    }),
  changeRole: adminProcedure.input(z.object({ userId: z.number().int().positive(), role: staffRole })).mutation(async ({ ctx, input }) => {
    try {
      return await updateStaffRole(input.userId, input.role, auditFor(ctx.user));
    } catch (error) {
      throwMappedStaffError(error);
    }
  }),
  setActive: adminProcedure.input(z.object({ userId: z.number().int().positive(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    try {
      return await setStaffAccountActive(input.userId, input.isActive, auditFor(ctx.user));
    } catch (error) {
      throwMappedStaffError(error);
    }
  }),
});
