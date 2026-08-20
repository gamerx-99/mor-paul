import { describe, expect, it } from "vitest";
import { clinicReportDay, summarizePaymentsByClinicDay } from "./reporting";

describe("clinic report day aggregation", () => {
  it("uses Bangkok operational dates without database date functions", () => {
    expect(clinicReportDay(new Date("2026-08-14T17:30:00.000Z"))).toBe("2026-08-15");
    expect(summarizePaymentsByClinicDay([
      { receivedAt: new Date("2026-08-14T14:30:00.000Z"), amountSatang: 1200 },
      { receivedAt: new Date("2026-08-14T17:30:00.000Z"), amountSatang: 800 },
      { receivedAt: new Date("2026-08-14T20:00:00.000Z"), amountSatang: 300 },
    ])).toEqual(new Map([["2026-08-14", 1200], ["2026-08-15", 1100]]));
  });
});
