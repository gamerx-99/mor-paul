import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAggregateOperationsReport, listAuditLogs, recordReportExportAudit, type AuditContext } from "../db";
import { adminProcedure, protectedProcedure, router } from "../_core/trpc";

const dateRangeInput = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).superRefine((value, ctx) => {
  if (value.from > value.to) {
    ctx.addIssue({ code: "custom", path: ["to"], message: "วันสิ้นสุดต้องไม่อยู่ก่อนวันเริ่มต้น" });
    return;
  }
  const start = new Date(`${value.from}T00:00:00.000Z`);
  const end = new Date(`${value.to}T00:00:00.000Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf()) || end.valueOf() - start.valueOf() > 92 * 86_400_000) {
    ctx.addIssue({ code: "custom", message: "เลือกช่วงรายงานได้ไม่เกิน 93 วัน" });
  }
});

function auditFor(user: { id: number; role: AuditContext["actorRole"] }): AuditContext {
  return { actorUserId: user.id, actorRole: user.role, requestId: randomUUID() };
}

export const reportsRouter = router({
  /**
   * All signed-in roles may read this one deliberately aggregate-only contract.
   * It contains no HN, patient/visit identifier, clinician identity, diagnosis,
   * invoice identifier, lot number, external payment reference or audit event.
   */
  operationalSummary: protectedProcedure.input(dateRangeInput).query(async ({ input }) => {
    try {
      return await getAggregateOperationsReport(input);
    } catch {
      // Do not expose database SQL, parameter values or driver messages to any role.
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ไม่สามารถจัดทำรายงานได้ในขณะนี้" });
    }
  }),

  /**
   * Audit log viewer is exclusively available to SYSTEM_ADMIN and provides zero-PHI activity trails.
   */
  listAuditLogs: adminProcedure
    .input(
      z.object({
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
        action: z.string().trim().max(96).optional().nullable(),
        actorRole: z.enum(["SYSTEM_ADMIN", "DOCTOR", "ASSISTANT"]).optional().nullable(),
        outcome: z.enum(["ALLOWED", "DENIED", "FAILED"]).optional().nullable(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      })
    )
    .query(async ({ input }) => {
      try {
        return await listAuditLogs(input);
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ไม่สามารถดึงข้อมูล Audit Log ได้" });
      }
    }),

  /**
   * Explicit audit trail recording when reports CSV is exported by an authorized user.
   */
  logCsvExport: protectedProcedure
    .input(
      z.object({
        reportType: z.string().trim().min(1).max(64),
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await recordReportExportAudit(auditFor(ctx.user), input.reportType, { from: input.from, to: input.to });
        return { success: true };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "ไม่สามารถบันทึก Audit การ Export ได้" });
      }
    }),
});

