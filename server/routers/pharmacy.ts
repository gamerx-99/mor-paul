import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addServiceCharge, bulkImportMedicationCatalog, createMedicationCatalogItem, dispenseSignedOrder, getCashierVisit, issueVisitInvoice, listActiveMedications, listCashierVisits, receiveInventoryLot, receiveInvoicePayment, setMedicationUnitPrice, type AuditContext } from "../db";
import { adminProcedure, assistantProcedure, medicationCatalogReadProcedure, router } from "../_core/trpc";

function auditFor(user: { id: number; role: AuditContext["actorRole"] }): AuditContext {
  return { actorUserId: user.id, actorRole: user.role, requestId: randomUUID() };
}

function mapDomainError(error: unknown): never {
  const code = error instanceof Error ? error.message : "";
  if (code === "MEDICATION_NOT_FOUND" || code === "CASHIER_VISIT_NOT_FOUND" || code === "INVOICE_NOT_FOUND") throw new TRPCError({ code: "NOT_FOUND", message: "ไม่พบข้อมูลที่เลือก" });
  if (code === "INSUFFICIENT_STOCK") throw new TRPCError({ code: "CONFLICT", message: "สต็อกยาไม่เพียงพอหรือมีการจ่ายจากหน้าจออื่น" });
  if (code === "ACTIVE_MEDICATION_PRICE_NOT_FOUND") throw new TRPCError({ code: "CONFLICT", message: "ยาบางรายการยังไม่มีราคาที่ใช้งานอยู่" });
  if (code === "VISIT_NOT_READY_FOR_DISPENSING" || code === "VISIT_NOT_READY_FOR_BILLING" || code === "SIGNED_MEDICATION_ORDER_NOT_FOUND" || code === "MEDICATION_ORDER_EMPTY" || code === "INVOICE_NOT_READY_FOR_PAYMENT" || code === "INVOICE_NOT_READY_FOR_ISSUING" || code === "VISIT_NOT_READY_FOR_CLOSURE") throw new TRPCError({ code: "CONFLICT", message: "สถานะรายการไม่พร้อมสำหรับการทำรายการนี้" });
  if (code === "PAYMENT_AMOUNT_MISMATCH") throw new TRPCError({ code: "BAD_REQUEST", message: "ยอดรับชำระต้องตรงกับยอดใบแจ้งหนี้" });
  if (code === "EXTERNAL_REFERENCE_REQUIRED") throw new TRPCError({ code: "BAD_REQUEST", message: "กรุณาระบุเลขอ้างอิงการชำระเงิน" });
  if (code === "INVALID_DATE") throw new TRPCError({ code: "BAD_REQUEST", message: "วันที่ไม่ถูกต้อง" });
  if (code === "MEDICATION_IMPORT_EMPTY") throw new TRPCError({ code: "BAD_REQUEST", message: "ไม่พบข้อมูลยาให้บันทึก" });
  if (code === "DUPLICATE_MEDICATION_CODE") throw new TRPCError({ code: "BAD_REQUEST", message: "พบรหัสยาซ้ำภายในไฟล์ CSV" });
  if (code === "MEDICATION_CODE_ALREADY_EXISTS") throw new TRPCError({ code: "CONFLICT", message: "มีรหัสยาบางรายการอยู่ในคลังแล้ว จึงยังไม่ได้บันทึกข้อมูลจากไฟล์" });
  throw error;
}

const medicationInput = z.object({
  code: z.string().trim().min(1).max(64),
  genericName: z.string().trim().min(1).max(255),
  tradeName: z.string().trim().max(255).optional().nullable().transform(value => value || null),
  dosageForm: z.string().trim().min(1).max(120),
  strength: z.string().trim().min(1).max(120),
});

const medicationImportInput = medicationInput.extend({
  unitPriceSatang: z.number().int().min(0).max(100_000_000),
});

const bulkMedicationImportInput = z.object({
  rows: z.array(medicationImportInput).min(1).max(200).superRefine((rows, ctx) => {
    const codes = new Set<string>();
    rows.forEach((row, index) => {
      const code = row.code.trim().toUpperCase();
      if (codes.has(code)) ctx.addIssue({ code: "custom", path: [index, "code"], message: "รหัสยาซ้ำภายในไฟล์" });
      codes.add(code);
    });
  }),
});

export const pharmacyRouter = router({
  catalog: router({
    search: medicationCatalogReadProcedure.input(z.object({ query: z.string().trim().max(120).optional() })).query(({ input }) => listActiveMedications(input.query)),
    create: adminProcedure.input(medicationInput).mutation(async ({ ctx, input }) => {
      try {
        return await createMedicationCatalogItem(input, auditFor(ctx.user));
      } catch (error) {
        mapDomainError(error);
      }
    }),
    setUnitPrice: adminProcedure.input(z.object({ medicationId: z.number().int().positive(), unitPriceSatang: z.number().int().min(0).max(100_000_000) })).mutation(async ({ ctx, input }) => {
      try {
        return await setMedicationUnitPrice(input, auditFor(ctx.user));
      } catch (error) {
        mapDomainError(error);
      }
    }),
    bulkImport: adminProcedure.input(bulkMedicationImportInput).mutation(async ({ ctx, input }) => {
      try {
        return await bulkImportMedicationCatalog(input.rows, auditFor(ctx.user));
      } catch (error) {
        mapDomainError(error);
      }
    }),
    receiveLot: adminProcedure.input(z.object({ medicationId: z.number().int().positive(), lotNumber: z.string().trim().min(1).max(120), expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), quantity: z.number().int().min(1).max(1_000_000), idempotencyKey: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      try {
        return await receiveInventoryLot(input, auditFor(ctx.user));
      } catch (error) {
        mapDomainError(error);
      }
    }),
  }),
  cashier: router({
    listVisits: assistantProcedure.query(() => listCashierVisits()),
    getVisit: assistantProcedure.input(z.object({ visitId: z.number().int().positive() })).query(async ({ input }) => {
      try {
        return await getCashierVisit(input.visitId);
      } catch (error) {
        mapDomainError(error);
      }
    }),
    dispense: assistantProcedure.input(z.object({ visitId: z.number().int().positive(), idempotencyKey: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      try {
        return await dispenseSignedOrder(input, ctx.user.id, auditFor(ctx.user));
      } catch (error) {
        mapDomainError(error);
      }
    }),
    addServiceCharge: assistantProcedure.input(z.object({
      visitId: z.number().int().positive(),
      description: z.string().trim().min(1).max(500),
      detail: z.string().trim().max(1000).optional().transform(value => value || null),
      quantity: z.number().int().min(1).max(100_000),
      unitPriceSatang: z.number().int().min(0).max(1_000_000_000),
    })).mutation(async ({ ctx, input }) => {
      try {
        return await addServiceCharge(input, ctx.user.id, auditFor(ctx.user));
      } catch (error) {
        mapDomainError(error);
      }
    }),
    issueInvoice: assistantProcedure.input(z.object({ visitId: z.number().int().positive(), idempotencyKey: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      try {
        return await issueVisitInvoice(input, ctx.user.id, auditFor(ctx.user));
      } catch (error) {
        mapDomainError(error);
      }
    }),
    receivePayment: assistantProcedure.input(z.object({ invoiceId: z.number().int().positive(), paymentMethod: z.enum(["CASH", "EXTERNAL_REFERENCE"]), amountSatang: z.number().int().min(0).max(1_000_000_000), externalReference: z.string().trim().max(255).optional().transform(value => value || null), idempotencyKey: z.string().uuid() })).mutation(async ({ ctx, input }) => {
      try {
        return await receiveInvoicePayment(input, ctx.user.id, auditFor(ctx.user));
      } catch (error) {
        mapDomainError(error);
      }
    }),
  }),
});
