export const CLINIC_REPORT_TIME_ZONE = "Asia/Bangkok";

export function clinicReportDay(value: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC_REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const lookup = new Map(parts.map(part => [part.type, part.value]));
  return `${lookup.get("year")}-${lookup.get("month")}-${lookup.get("day")}`;
}

export function summarizePaymentsByClinicDay(rows: Array<{ receivedAt: Date; amountSatang: number }>) {
  const summary = new Map<string, number>();
  for (const row of rows) {
    const day = clinicReportDay(row.receivedAt);
    summary.set(day, (summary.get(day) ?? 0) + Number(row.amountSatang));
  }
  return summary;
}
