import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getAggregateOperationsReport } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

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
});
