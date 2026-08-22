import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { callNextQueue, checkDuplicatePatients, createPatient, createVisit, findPatientByHn, getPatientNationalIdStatus, listQueueByDate, recordPatientNationalId, searchPatients, upsertTriageRecord, type AuditContext } from "../db";
import { assistantProcedure, clinicalReadProcedure, doctorProcedure, router } from "../_core/trpc";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ต้องเป็น YYYY-MM-DD");
const optionalText = (max: number) => z.string().trim().max(max).optional().transform(value => value || null);

const patientInput = z.object({
  firstName: z.string().trim().min(1, "กรุณาระบุชื่อ").max(120),
  lastName: z.string().trim().min(1, "กรุณาระบุนามสกุล").max(120),
  dateOfBirth: dateOnly,
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNSPECIFIED"]),
  phone: optionalText(32),
  address: optionalText(5000),
  allergySummary: optionalText(1000),
  idDocumentType: z.enum(["THAI_NATIONAL_ID", "PASSPORT"]),
  idDocumentNumber: z.string().trim().min(1, "กรุณาระบุเลขเอกสารยืนยันตัวตน").max(32),
  consentAccepted: z.boolean().refine(val => val === true, { message: "กรุณายินยอมให้จัดเก็บและประมวลผลข้อมูลตามนโยบายความเป็นส่วนตัว (PDPA)" }),
});

const triageInput = z.object({
  visitId: z.number().int().positive(),
  bloodPressureSystolic: z.number().int().min(0).max(300).nullable().optional(),
  bloodPressureDiastolic: z.number().int().min(0).max(250).nullable().optional(),
  pulse: z.number().int().min(0).max(300).nullable().optional(),
  temperatureCelsius: z.string().regex(/^\d{1,2}(\.\d)?$/).nullable().optional(),
  oxygenSaturation: z.number().int().min(0).max(100).nullable().optional(),
  weightKg: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).nullable().optional(),
  heightCm: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/).nullable().optional(),
  triageNote: optionalText(2000),
  urgency: z.enum(["ROUTINE", "PRIORITY", "URGENT"]),
});

function auditFor(user: { id: number; role: AuditContext["actorRole"] }): AuditContext {
  return { actorUserId: user.id, actorRole: user.role, requestId: randomUUID() };
}

function throwMappedDomainError(error: unknown): never {
  const code = error instanceof Error ? error.message : "";
  if (code === "INVALID_DATE") throw new TRPCError({ code: "BAD_REQUEST", message: "วันที่ไม่ถูกต้อง" });
  if (code === "INVALID_NATIONAL_ID") throw new TRPCError({ code: "BAD_REQUEST", message: "เลขบัตรประชาชนไม่ถูกต้อง" });
  if (code === "INVALID_PASSPORT") throw new TRPCError({ code: "BAD_REQUEST", message: "หมายเลข Passport ไม่ถูกต้อง" });
  if (code === "NATIONAL_ID_WRITE_ONCE") throw new TRPCError({ code: "CONFLICT", message: "เลขบัตรประชาชนถูกบันทึกแล้วและไม่สามารถแก้ไขได้" });
  if (code === "PATIENT_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบผู้รับบริการที่เลือก" });
  if (code === "VISIT_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบรายการรับบริการ" });
  if (code === "TRIAGE_NOT_ALLOWED_FOR_VISIT_STATE") throw new TRPCError({ code: "CONFLICT", message: "สถานะรายการนี้ไม่อนุญาตให้บันทึก triage" });
  throw error;
}

export const frontDeskRouter = router({
  checkDuplicates: assistantProcedure
    .input(
      z.object({
        firstName: z.string().trim().min(1),
        lastName: z.string().trim().min(1),
        dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      })
    )
    .query(({ input }) => checkDuplicatePatients(input)),
  registerPatient: assistantProcedure.input(patientInput).mutation(async ({ ctx, input }) => {
    try {
      return await createPatient(input, auditFor(ctx.user));
    } catch (error) {
      throwMappedDomainError(error);
    }
  }),
  searchPatients: clinicalReadProcedure.input(z.object({ query: z.string().trim().min(1).max(120) })).query(({ input }) => searchPatients(input.query)),
  findPatientByHn: clinicalReadProcedure.input(z.object({ hn: z.string().trim().min(3).max(24) })).query(({ input }) => findPatientByHn(input.hn)),
  nationalIdStatus: assistantProcedure.input(z.object({ patientId: z.number().int().positive() })).query(async ({ input }) => {
    try {
      return await getPatientNationalIdStatus(input.patientId);
    } catch (error) {
      throwMappedDomainError(error);
    }
  }),
  recordNationalId: assistantProcedure
    .input(z.object({ patientId: z.number().int().positive(), nationalId: z.string().trim().min(1).max(32), source: z.enum(["ASSISTANT_ENTRY", "LOCAL_SMART_CARD_BRIDGE"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await recordPatientNationalId(input, auditFor(ctx.user));
      } catch (error) {
        const code = error instanceof Error ? error.message : "";
        if (code.includes("Duplicate") || code.includes("ER_DUP_ENTRY")) throw new TRPCError({ code: "CONFLICT", message: "เลขบัตรประชาชนนี้ถูกบันทึกไว้แล้ว" });
        throwMappedDomainError(error);
      }
    }),
  createVisit: assistantProcedure
    .input(z.object({ patientId: z.number().int().positive(), visitDate: dateOnly, chiefComplaint: z.string().trim().min(1, "กรุณาระบุอาการสำคัญ").max(2000) }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await createVisit(input, auditFor(ctx.user));
      } catch (error) {
        throwMappedDomainError(error);
      }
    }),
  listQueue: clinicalReadProcedure.input(z.object({ queueDate: dateOnly })).query(({ input }) => listQueueByDate(input.queueDate)),
  recordTriage: assistantProcedure.input(triageInput).mutation(async ({ ctx, input }) => {
    try {
      return await upsertTriageRecord(input, auditFor(ctx.user));
    } catch (error) {
      throwMappedDomainError(error);
    }
  }),
  callNext: doctorProcedure.input(z.object({ queueDate: dateOnly })).mutation(async ({ ctx, input }) => {
    try {
      return await callNextQueue(input.queueDate, ctx.user.id, auditFor(ctx.user));
    } catch (error) {
      throwMappedDomainError(error);
    }
  }),
});
