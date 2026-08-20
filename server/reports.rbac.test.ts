import { beforeEach, describe, expect, it, vi } from "vitest";

const database = vi.hoisted(() => ({
  getAggregateOperationsReport: vi.fn(),
  listAuditLogs: vi.fn(),
  recordReportExportAudit: vi.fn(),
}));

vi.mock("./db", () => database);

import { reportsRouter } from "./routers/reports";

const doctor = { id: 11, username: "doctor", role: "DOCTOR" as const };
const assistant = { id: 12, username: "assistant", role: "ASSISTANT" as const };
const admin = { id: 13, username: "admin", role: "SYSTEM_ADMIN" as const };
const range = { from: "2026-08-01", to: "2026-08-07" };

function callerFor(user: typeof doctor | typeof assistant | typeof admin | null) {
  return reportsRouter.createCaller({ user, req: { secure: true, headers: {} }, res: {} } as never);
}

describe("Reports v1 aggregate RBAC and contract", () => {
  beforeEach(() => vi.clearAllMocks());

  it("allows all signed-in roles to read the same aggregate-only report", async () => {
    const aggregateOnlyPayload = {
      range,
      generatedAt: new Date("2026-08-07T08:00:00.000Z"),
      summary: { visitCount: 4, paymentCount: 2, paidSatang: 25000, dispensedUnits: 8, activeLotCount: 3, onHandUnits: 40, expiringLotCount: 1 },
      daily: [{ day: "2026-08-01", visitCount: 4, paidSatang: 25000 }],
      topMedications: [{ medicationId: 4, genericName: "ยา A", dosageForm: "Tablet", strength: "5 mg", dispensedUnits: 8 }],
    };
    database.getAggregateOperationsReport.mockResolvedValue(aggregateOnlyPayload);

    for (const user of [doctor, assistant, admin]) {
      await expect(callerFor(user).operationalSummary(range)).resolves.toEqual(aggregateOnlyPayload);
    }
    expect(database.getAggregateOperationsReport).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(aggregateOnlyPayload)).not.toMatch(/hn|patient|diagnosis|invoiceNumber|lotNumber|externalReference/i);
  });

  it("denies an unauthenticated report request before database access", async () => {
    await expect(callerFor(null).operationalSummary(range)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(database.getAggregateOperationsReport).not.toHaveBeenCalled();
  });

  it("rejects an inverted or excessive date range before database access", async () => {
    await expect(callerFor(admin).operationalSummary({ from: "2026-08-07", to: "2026-08-01" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(callerFor(admin).operationalSummary({ from: "2026-01-01", to: "2026-05-01" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(database.getAggregateOperationsReport).not.toHaveBeenCalled();
  });

  it("maps unexpected database failures to a safe Thai message without SQL details", async () => {
    database.getAggregateOperationsReport.mockRejectedValue(new Error("Failed query: select date(receivedAt) params: secret"));

    await expect(callerFor(admin).operationalSummary(range)).rejects.toMatchObject({
      code: "INTERNAL_SERVER_ERROR",
      message: "ไม่สามารถจัดทำรายงานได้ในขณะนี้",
    });
  });

  it("permits only SYSTEM_ADMIN to access listAuditLogs and denies clinical roles", async () => {
    database.listAuditLogs.mockResolvedValue({ items: [], totalCount: 0, limit: 50, offset: 0 });

    await expect(callerFor(admin).listAuditLogs({})).resolves.toMatchObject({ totalCount: 0 });
    expect(database.listAuditLogs).toHaveBeenCalled();

    for (const user of [doctor, assistant]) {
      await expect(callerFor(user).listAuditLogs({})).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("allows authenticated roles to log CSV export audit", async () => {
    database.recordReportExportAudit.mockResolvedValue(undefined);

    await expect(
      callerFor(assistant).logCsvExport({ reportType: "OPERATIONAL_SUMMARY", from: "2026-08-01", to: "2026-08-07" })
    ).resolves.toMatchObject({ success: true });

    expect(database.recordReportExportAudit).toHaveBeenCalled();
  });
});
