import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { createClinicalPreset, deleteClinicalPreset, getDoctorConsultation, getPatientClinicalHistory, listClinicalPresets, listSoapTemplates, createSoapTemplate, updateSoapTemplate, deactivateSoapTemplate, saveClinicalDraft, signClinicalEncounter, type AuditContext } from "../db";
import { doctorProcedure, router } from "../_core/trpc";

const optionalClinicalText = (max: number) => z.string().trim().max(max).optional().transform(value => value || null);

const noteInput = z.object({
  visitId: z.number().int().positive(),
  expectedRevision: z.number().int().min(0),
  subjective: optionalClinicalText(10_000),
  objective: optionalClinicalText(10_000),
  assessment: optionalClinicalText(10_000),
  plan: optionalClinicalText(10_000),
});

const diagnosisInput = z.object({
  code: z.string().trim().min(1).max(32).optional().transform(value => value || null),
  display: z.string().trim().min(1, "กรุณาระบุการวินิจฉัย").max(1000),
});

const medicationOrderInput = z.object({
  medicationId: z.number().int().positive(),
  dose: z.string().trim().min(1, "กรุณาระบุขนาดยา").max(255),
  frequency: z.string().trim().min(1, "กรุณาระบุความถี่").max(255),
  duration: z.string().trim().max(255).optional().transform(value => value || null),
  quantityPrescribed: z.number().int().min(1).max(10_000),
  instructions: z.string().trim().max(1000).optional().transform(value => value || null),
});

const presetInput = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อชุดคำสั่งด่วน").max(120),
  description: z.string().trim().max(500).optional().transform(value => value || null),
  diagnoses: z.array(diagnosisInput).max(12).default([]),
  medications: z.array(medicationOrderInput).max(20).default([]),
});

function auditFor(user: { id: number; role: AuditContext["actorRole"] }): AuditContext {
  return { actorUserId: user.id, actorRole: user.role, requestId: randomUUID() };
}

function throwMappedClinicalError(error: unknown): never {
  const code = error instanceof Error ? error.message : "";
  if (code === "CONSULTATION_NOT_ASSIGNED_TO_DOCTOR") throw new TRPCError({ code: "FORBIDDEN", message: "รายการนี้ไม่ได้รับมอบหมายให้แพทย์ผู้ใช้งาน" });
  if (code === "CONSULTATION_NOT_ACTIVE") throw new TRPCError({ code: "CONFLICT", message: "รายการนี้ไม่ได้อยู่ระหว่างตรวจ" });
  if (code === "CLINICAL_NOTE_ALREADY_SIGNED") throw new TRPCError({ code: "CONFLICT", message: "บันทึกการตรวจลงนามแล้วและไม่สามารถแก้ไขได้" });
  if (code === "CLINICAL_NOTE_AUTHORED_BY_ANOTHER_DOCTOR") throw new TRPCError({ code: "FORBIDDEN", message: "บันทึกฉบับร่างเป็นของแพทย์ท่านอื่น" });
  if (code === "STALE_CLINICAL_NOTE" || code === "STALE_VISIT") throw new TRPCError({ code: "CONFLICT", message: "ข้อมูลถูกแก้ไขจากหน้าจออื่น กรุณาโหลดใหม่ก่อนบันทึก" });
  if (code === "MEDICATION_NOT_FOUND_OR_INACTIVE") throw new TRPCError({ code: "BAD_REQUEST", message: "ไม่พบยา หรือยานี้ถูกปิดใช้งาน" });
  if (code === "DUPLICATE_MEDICATION_ORDER_ITEM") throw new TRPCError({ code: "BAD_REQUEST", message: "ไม่สามารถสั่งยารายการเดิมซ้ำในคำสั่งเดียวกัน" });
  if (code === "PATIENT_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบผู้รับบริการ" });
  if (code === "PRESET_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบชุดคำสั่งด่วนนี้" });
  throw error;
}

export const doctorConsoleRouter = router({
  getConsultation: doctorProcedure.input(z.object({ visitId: z.number().int().positive() })).query(async ({ ctx, input }) => {
    try {
      return await getDoctorConsultation(input.visitId, ctx.user.id);
    } catch (error) {
      throwMappedClinicalError(error);
    }
  }),
  getPatientHistory: doctorProcedure.input(z.object({ patientId: z.number().int().positive() })).query(async ({ input }) => {
    try {
      return await getPatientClinicalHistory(input.patientId);
    } catch (error) {
      throwMappedClinicalError(error);
    }
  }),
  saveDraft: doctorProcedure.input(noteInput).mutation(async ({ ctx, input }) => {
    try {
      return await saveClinicalDraft(input, ctx.user.id, auditFor(ctx.user));
    } catch (error) {
      throwMappedClinicalError(error);
    }
  }),
  signEncounter: doctorProcedure.input(noteInput.extend({ expectedVisitVersion: z.number().int().positive(), diagnoses: z.array(diagnosisInput).min(1, "กรุณาระบุการวินิจฉัยอย่างน้อยหนึ่งรายการ").max(12), medications: z.array(medicationOrderInput).max(20).default([]) })).mutation(async ({ ctx, input }) => {
    try {
      return await signClinicalEncounter(input, ctx.user.id, auditFor(ctx.user));
    } catch (error) {
      throwMappedClinicalError(error);
    }
  }),
  listPresets: doctorProcedure.query(async ({ ctx }) => {
    try {
      return await listClinicalPresets(ctx.user.id);
    } catch (error) {
      throwMappedClinicalError(error);
    }
  }),
  createPreset: doctorProcedure.input(presetInput).mutation(async ({ ctx, input }) => {
    try {
      return await createClinicalPreset(input, ctx.user.id, auditFor(ctx.user));
    } catch (error) {
      throwMappedClinicalError(error);
    }
  }),
  deletePreset: doctorProcedure.input(z.object({ presetId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      return await deleteClinicalPreset(input.presetId, ctx.user.id, auditFor(ctx.user));
    } catch (error) {
      throwMappedClinicalError(error);
    }
  }),
  listSoapTemplates: doctorProcedure.input(z.object({ serviceType: z.string().optional() }).optional()).query(async ({ input }) => {
    try {
      return await listSoapTemplates(input?.serviceType ? { serviceType: input.serviceType } : undefined);
    } catch (error) {
      throwMappedClinicalError(error);
    }
  }),
  createSoapTemplate: doctorProcedure.input(z.object({
    serviceType: z.enum(["general", "followup", "acute", "chronic", "wellness", "other"]),
    name: z.string().min(2).max(120),
    subjectiveTemplate: z.string().min(1).max(4000),
    objectiveTemplate: z.string().min(1).max(4000),
    assessmentTemplate: z.string().min(1).max(4000),
    planTemplate: z.string().min(1).max(4000),
  })).mutation(async ({ ctx, input }) => {
    try {
      return await createSoapTemplate({
        ...input,
        createdBy: ctx.user.id,
      }, auditFor(ctx.user));
    } catch (error) {
      throwMappedClinicalError(error);
    }
  }),
  updateSoapTemplate: doctorProcedure.input(z.object({
    id: z.number().int().positive(),
    name: z.string().min(2).max(120).optional(),
    subjectiveTemplate: z.string().min(1).max(4000).optional(),
    objectiveTemplate: z.string().min(1).max(4000).optional(),
    assessmentTemplate: z.string().min(1).max(4000).optional(),
    planTemplate: z.string().min(1).max(4000).optional(),
    isActive: z.boolean().optional(),
  })).mutation(async ({ ctx, input }) => {
    try {
      const { id, ...patch } = input;
      return await updateSoapTemplate(id, patch, auditFor(ctx.user));
    } catch (error) {
      throwMappedClinicalError(error);
    }
  }),
  deactivateSoapTemplate: doctorProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      return await deactivateSoapTemplate(input.id, auditFor(ctx.user));
    } catch (error) {
      throwMappedClinicalError(error);
    }
  }),
});

