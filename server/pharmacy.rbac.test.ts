import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  countUsers: vi.fn(),
  createInitialAdmin: vi.fn(),
  createSession: vi.fn(),
  findUserByUsername: vi.fn(),
  recordLoginFailure: vi.fn(),
  recordLoginSuccess: vi.fn(),
  revokeSession: vi.fn(),
  getDoctorConsultation: vi.fn(),
  saveClinicalDraft: vi.fn(),
  signClinicalEncounter: vi.fn(),
  listStaffAccounts: vi.fn(),
  createStaffAccount: vi.fn(),
  setStaffAccountActive: vi.fn(),
  updateStaffRole: vi.fn(),
  createMedicationCatalogItem: vi.fn(),
  bulkImportMedicationCatalog: vi.fn(),
  addServiceCharge: vi.fn(),
  dispenseSignedOrder: vi.fn(),
  getCashierVisit: vi.fn(),
  listActiveMedications: vi.fn(),
  listCashierVisits: vi.fn(),
  issueVisitInvoice: vi.fn(),
  receiveInventoryLot: vi.fn(),
  receiveInvoicePayment: vi.fn(),
  setMedicationUnitPrice: vi.fn(),
}));

vi.mock("./db", () => database);

import { appRouter } from "./routers";

const doctor = { id: 11, username: "doctor", role: "DOCTOR" as const };
const assistant = { id: 12, username: "assistant", role: "ASSISTANT" as const };
const admin = { id: 13, username: "admin", role: "SYSTEM_ADMIN" as const };

function callerFor(user: typeof doctor | typeof assistant | typeof admin) {
  return appRouter.createCaller({ user, req: { secure: true, headers: {} }, res: { cookie: vi.fn(), clearCookie: vi.fn() } } as never);
}

describe("pharmacy and cashier RBAC", () => {
  beforeEach(() => vi.clearAllMocks());

  it("denies System Admin before a PHI-facing cashier read executes", async () => {
    await expect(callerFor(admin).pharmacy.cashier.listVisits()).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(database.listCashierVisits).not.toHaveBeenCalled();
  });

  it("denies doctor and assistant before catalog administration executes", async () => {
    const input = { code: "MED-001", genericName: "Test", dosageForm: "Tablet", strength: "1 mg", tradeName: null };
    for (const user of [doctor, assistant]) {
      await expect(callerFor(user).pharmacy.catalog.create(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(database.createMedicationCatalogItem).not.toHaveBeenCalled();
  });

  it("allows only System Admin to atomically import validated medication rows", async () => {
    const rows = [{ code: "CAT-001", genericName: "Catalog item", tradeName: null, dosageForm: "Tablet", strength: "1 mg", unitPriceSatang: 1250 }];
    database.bulkImportMedicationCatalog.mockResolvedValue({ importedCount: 1, medicationIds: [31] });

    await expect(callerFor(admin).pharmacy.catalog.bulkImport({ rows })).resolves.toEqual({ importedCount: 1, medicationIds: [31] });
    expect(database.bulkImportMedicationCatalog).toHaveBeenCalledWith(rows, expect.objectContaining({ actorUserId: admin.id, actorRole: "SYSTEM_ADMIN" }));
    for (const user of [doctor, assistant]) {
      await expect(callerFor(user).pharmacy.catalog.bulkImport({ rows })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("rejects invalid or duplicate CSV rows before an import transaction runs", async () => {
    const duplicateRows = [
      { code: "CAT-001", genericName: "Catalog item", tradeName: null, dosageForm: "Tablet", strength: "1 mg", unitPriceSatang: 1250 },
      { code: "cat-001", genericName: "Catalog item two", tradeName: null, dosageForm: "Tablet", strength: "2 mg", unitPriceSatang: 2500 },
    ];
    await expect(callerFor(admin).pharmacy.catalog.bulkImport({ rows: duplicateRows })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(callerFor(admin).pharmacy.catalog.bulkImport({ rows: [{ code: "", genericName: "Catalog item", tradeName: null, dosageForm: "Tablet", strength: "1 mg", unitPriceSatang: 1250 }] })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(database.bulkImportMedicationCatalog).not.toHaveBeenCalled();
  });

  it("maps an existing medication code to a safe conflict without reporting database details", async () => {
    database.bulkImportMedicationCatalog.mockRejectedValue(new Error("MEDICATION_CODE_ALREADY_EXISTS"));
    await expect(callerFor(admin).pharmacy.catalog.bulkImport({ rows: [{ code: "CAT-001", genericName: "Catalog item", tradeName: null, dosageForm: "Tablet", strength: "1 mg", unitPriceSatang: 1250 }] })).rejects.toMatchObject({ code: "CONFLICT", message: "มีรหัสยาบางรายการอยู่ในคลังแล้ว จึงยังไม่ได้บันทึกข้อมูลจากไฟล์" });
  });

  it("allows clinical staff to browse only active medication catalog data", async () => {
    database.listActiveMedications.mockResolvedValue([{ id: 1, code: "MED-001", genericName: "Example", tradeName: null, dosageForm: "Tablet", strength: "1 mg" }]);
    await expect(callerFor(doctor).pharmacy.catalog.search({ query: "MED" })).resolves.toHaveLength(1);
    await expect(callerFor(assistant).pharmacy.catalog.search({ query: "MED" })).resolves.toHaveLength(1);
    expect(database.listActiveMedications).toHaveBeenCalledWith("MED");
  });

  it("allows only Assistant to add a distinct service charge to a visit waiting for billing", async () => {
    const input = { visitId: 22, description: "ค่าตรวจแพทย์", detail: "ตรวจติดตามอาการ", quantity: 1, unitPriceSatang: 5000 };
    database.addServiceCharge.mockResolvedValue({ serviceChargeId: 71, visitId: input.visitId, lineTotalSatang: 5000, status: "PENDING" });

    await expect(callerFor(assistant).pharmacy.cashier.addServiceCharge(input)).resolves.toMatchObject({ serviceChargeId: 71, status: "PENDING" });
    expect(database.addServiceCharge).toHaveBeenCalledWith(input, assistant.id, expect.objectContaining({ actorUserId: assistant.id, actorRole: "ASSISTANT" }));
    for (const user of [doctor, admin]) {
      await expect(callerFor(user).pharmacy.cashier.addServiceCharge(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("validates service-charge fields before the billing transaction runs", async () => {
    await expect(callerFor(assistant).pharmacy.cashier.addServiceCharge({ visitId: 22, description: "", detail: "", quantity: 0, unitPriceSatang: -1 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(database.addServiceCharge).not.toHaveBeenCalled();
  });

  it("issues a no-medication invoice through the assistant-only contract so payment can close the encounter", async () => {
    const input = { visitId: 41, idempotencyKey: "77777777-7777-4777-8777-777777777777" };
    database.issueVisitInvoice.mockResolvedValue({ invoiceId: 88, visitId: input.visitId, invoiceNumber: "INV-00000041", totalSatang: 0, replayed: false });

    await expect(callerFor(assistant).pharmacy.cashier.issueInvoice(input)).resolves.toMatchObject({ invoiceId: 88, totalSatang: 0, replayed: false });
    expect(database.issueVisitInvoice).toHaveBeenCalledWith(input, assistant.id, expect.objectContaining({ actorUserId: assistant.id, actorRole: "ASSISTANT" }));
    for (const user of [doctor, admin]) {
      await expect(callerFor(user).pharmacy.cashier.issueInvoice(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("maps a premature billing attempt to a safe workflow conflict", async () => {
    database.issueVisitInvoice.mockRejectedValue(new Error("VISIT_NOT_READY_FOR_BILLING"));
    await expect(callerFor(assistant).pharmacy.cashier.issueInvoice({ visitId: 42, idempotencyKey: "88888888-8888-4888-8888-888888888888" })).rejects.toMatchObject({ code: "CONFLICT", message: "สถานะรายการไม่พร้อมสำหรับการทำรายการนี้" });
  });

  it("preserves the cashier idempotency key and returns a replayed payment without creating client-side duplicate state", async () => {
    const input = {
      invoiceId: 22,
      paymentMethod: "CASH" as const,
      amountSatang: 12500,
      externalReference: "",
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
    };
    database.receiveInvoicePayment.mockResolvedValue({ paymentId: 7, invoiceId: input.invoiceId, replayed: true });

    await expect(callerFor(assistant).pharmacy.cashier.receivePayment(input)).resolves.toEqual({ paymentId: 7, invoiceId: input.invoiceId, replayed: true });
    expect(database.receiveInvoicePayment).toHaveBeenCalledWith(expect.objectContaining({ ...input, externalReference: null }), assistant.id, expect.objectContaining({ actorUserId: assistant.id, actorRole: "ASSISTANT" }));
  });

  it("forwards a successful cash payment through the assistant-only transaction contract", async () => {
    const input = {
      invoiceId: 23,
      paymentMethod: "CASH" as const,
      amountSatang: 9800,
      externalReference: "",
      idempotencyKey: "44444444-4444-4444-8444-444444444444",
    };
    database.receiveInvoicePayment.mockResolvedValue({ paymentId: 8, invoiceId: input.invoiceId, replayed: false });

    await expect(callerFor(assistant).pharmacy.cashier.receivePayment(input)).resolves.toEqual({ paymentId: 8, invoiceId: input.invoiceId, replayed: false });
    expect(database.receiveInvoicePayment).toHaveBeenCalledWith(expect.objectContaining({ ...input, externalReference: null }), assistant.id, expect.objectContaining({ actorUserId: assistant.id, actorRole: "ASSISTANT" }));
  });

  it("maps a payment amount mismatch to a safe validation error", async () => {
    database.receiveInvoicePayment.mockRejectedValue(new Error("PAYMENT_AMOUNT_MISMATCH"));

    await expect(callerFor(assistant).pharmacy.cashier.receivePayment({
      invoiceId: 24,
      paymentMethod: "CASH",
      amountSatang: 1,
      externalReference: "",
      idempotencyKey: "55555555-5555-4555-8555-555555555555",
    })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "ยอดรับชำระต้องตรงกับยอดใบแจ้งหนี้",
    });
  });

  it("forwards a successful dispense through the assistant-only transaction contract", async () => {
    const input = { visitId: 22, idempotencyKey: "33333333-3333-4333-8333-333333333333" };
    database.dispenseSignedOrder.mockResolvedValue({ dispensationId: 5, invoiceId: 6, invoiceNumber: "INV-00000022", totalSatang: 12500, status: "COMPLETED", replayed: false });

    await expect(callerFor(assistant).pharmacy.cashier.dispense(input)).resolves.toMatchObject({ dispensationId: 5, invoiceId: 6, replayed: false });
    expect(database.dispenseSignedOrder).toHaveBeenCalledWith(input, assistant.id, expect.objectContaining({ actorUserId: assistant.id, actorRole: "ASSISTANT" }));
  });

  it("maps insufficient stock to a conflict before a cashier can treat a dispense as complete", async () => {
    database.dispenseSignedOrder.mockRejectedValue(new Error("INSUFFICIENT_STOCK"));

    await expect(callerFor(assistant).pharmacy.cashier.dispense({ visitId: 22, idempotencyKey: "22222222-2222-4222-8222-222222222222" })).rejects.toMatchObject({
      code: "CONFLICT",
      message: "สต็อกยาไม่เพียงพอหรือมีการจ่ายจากหน้าจออื่น",
    });
  });
});
