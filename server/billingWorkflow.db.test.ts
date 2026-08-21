import { beforeEach, describe, expect, it, vi } from "vitest";

const drizzleFactory = vi.hoisted(() => vi.fn());

vi.mock("drizzle-orm/postgres-js", async () => {
  const actual = await vi.importActual<typeof import("drizzle-orm/postgres-js")>("drizzle-orm/postgres-js");
  return { ...actual, drizzle: drizzleFactory };
});

import { dispenseSignedOrder, issueVisitInvoice, receiveInvoicePayment } from "./db";

type RecordedInsert = { values: unknown };
type RecordedUpdate = { values: Record<string, unknown> };

const selectResults: unknown[][] = [];
const insertCalls: RecordedInsert[] = [];
const updateCalls: RecordedUpdate[] = [];
let nextInsertId = 100;

function queryFor(result: unknown[]) {
  const query: {
    where: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    orderBy: ReturnType<typeof vi.fn>;
    then: PromiseLike<unknown[]>["then"];
  } = {
    where: vi.fn(),
    limit: vi.fn(),
    orderBy: vi.fn(),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  query.where.mockReturnValue(query);
  query.limit.mockResolvedValue(result);
  query.orderBy.mockReturnValue(query);
  return query;
}

const tx = {
  select: vi.fn(() => ({ from: vi.fn(() => queryFor(selectResults.shift() ?? [])) })),
  insert: vi.fn(() => ({ values: vi.fn(async (values: unknown) => {
    insertCalls.push({ values });
    nextInsertId += 1;
    return [{ insertId: nextInsertId }];
  }) })),
  update: vi.fn(() => ({ set: vi.fn((values: Record<string, unknown>) => ({ where: vi.fn(async () => {
    updateCalls.push({ values });
    return [{ affectedRows: 1 }];
  }) })) })),
};

const db = { transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)) };

const audit = { actorUserId: 12, actorRole: "ASSISTANT" as const, requestId: "test-request" };

describe("billing workflow database transaction", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://billing-test";
    drizzleFactory.mockReturnValue(db);
    selectResults.splice(0);
    insertCalls.splice(0);
    updateCalls.splice(0);
    nextInsertId = 100;
    vi.clearAllMocks();
    drizzleFactory.mockReturnValue(db);
  });

  it("keeps medication and service charge lines distinct, totals them in one invoice, and closes only after payment", async () => {
    selectResults.push(
      [],
      [{ id: 41, status: "DISPENSING" }],
      [{ id: 60, visitId: 41, status: "SIGNED" }],
      [{ id: 70, clinicalOrderId: 60, medicationId: 31, medicationNameSnapshot: "ยา ก", strengthSnapshot: "500 mg", quantityPrescribed: 1 }],
      [{ id: 80, medicationId: 31, expiryDate: "2030-01-01", remainingQuantity: 5 }],
      [{ id: 90, medicationId: 31, unitPriceSatang: 2500 }],
    );
    const dispense = await dispenseSignedOrder({ visitId: 41, idempotencyKey: "dispense-request" }, 12, audit);

    expect(updateCalls.some(call => call.values.status === "CLOSED")).toBe(false);
    expect(updateCalls.some(call => call.values.status === "BILLED")).toBe(false);

    selectResults.push(
      [],
      [{ id: 41, status: "DISPENSING" }],
      [{ id: dispense.invoiceId, visitId: 41, invoiceNumber: "INV-00000041", status: "DRAFT" }],
      [{ id: 91, visitId: 41, description: "ค่าตรวจแพทย์", detail: "ตรวจติดตาม", quantity: 1, unitPriceSatang: 5000, status: "PENDING" }],
      [{ totalSatang: 7500 }],
      [{ count: 1 }],
    );
    const issued = await issueVisitInvoice({ visitId: 41, idempotencyKey: "invoice-request" }, 12, audit);

    const lineGroups = insertCalls
      .map(call => call.values)
      .filter(Array.isArray)
      .flat() as Array<{ sourceType?: string; lineTotalSatang?: number }>;
    expect(lineGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceType: "MEDICATION_ORDER_ITEM", lineTotalSatang: 2500 }),
      expect.objectContaining({ sourceType: "SERVICE_CHARGE", lineTotalSatang: 5000 }),
    ]));
    expect(issued.totalSatang).toBe(7500);
    expect(updateCalls.some(call => call.values.status === "BILLED")).toBe(true);
    expect(updateCalls.some(call => call.values.status === "CLOSED")).toBe(false);

    selectResults.push(
      [],
      [{ id: issued.invoiceId, visitId: 41, status: "ISSUED", totalSatang: 7500 }],
    );
    await receiveInvoicePayment({ invoiceId: issued.invoiceId, paymentMethod: "CASH", amountSatang: 7500, idempotencyKey: "payment-request" }, 12, audit);

    expect(updateCalls.some(call => call.values.status === "PAID")).toBe(true);
    expect(updateCalls.some(call => call.values.status === "CLOSED")).toBe(true);
  });

  it("rejects payment that does not equal the issued invoice before any status changes can close the visit", async () => {
    selectResults.push(
      [],
      [{ id: 88, visitId: 41, status: "ISSUED", totalSatang: 7500 }],
    );

    await expect(receiveInvoicePayment({ invoiceId: 88, paymentMethod: "CASH", amountSatang: 1, idempotencyKey: "mismatch-request" }, 12, audit)).rejects.toThrow("PAYMENT_AMOUNT_MISMATCH");
    expect(updateCalls).toHaveLength(0);
  });
});
