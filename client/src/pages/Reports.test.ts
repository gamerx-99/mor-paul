import { describe, expect, it } from "vitest";
import { csvValue } from "./Reports";

describe("Reports CSV export", () => {
  it("quotes ordinary values and neutralizes spreadsheet formula prefixes", () => {
    expect(csvValue("ยาเม็ด")).toBe('"ยาเม็ด"');
    expect(csvValue("=HYPERLINK(\"https://example.invalid\")")).toBe('"\'=HYPERLINK(\"\"https://example.invalid\"\")"');
    expect(csvValue("+100")).toBe('"\'+100"');
    expect(csvValue("-100")).toBe('"\'-100"');
    expect(csvValue("@formula")).toBe('"\'@formula"');
  });
});
