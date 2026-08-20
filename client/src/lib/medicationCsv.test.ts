import { describe, expect, it } from "vitest";
import { medicationCsvTemplate, parseMedicationCatalogCsv } from "./medicationCsv";

describe("medication CSV preview parser", () => {
  it("parses a valid CSV into medication and price rows without writing data", () => {
    const preview = parseMedicationCatalogCsv(`${medicationCsvTemplate()}CAT-001,Generic one,,Tablet,1 mg,12.50\n`);
    expect(preview).toMatchObject({ totalRows: 1, invalidRows: [], validRows: [{ rowNumber: 2, code: "CAT-001", unitPriceSatang: 1250 }] });
  });

  it("keeps an invalid money value in preview errors and prevents a valid import set", () => {
    const preview = parseMedicationCatalogCsv(`${medicationCsvTemplate()}CAT-001,Generic one,,Tablet,1 mg,12.345\n`);
    expect(preview.validRows).toHaveLength(0);
    expect(preview.invalidRows).toEqual([{ rowNumber: 2, message: "pricePerUnit ต้องเป็นจำนวนเงินตั้งแต่ 0.00 ถึง 1,000,000.00" }]);
  });

  it("flags duplicate medication codes in the selected file before confirmation", () => {
    const preview = parseMedicationCatalogCsv(`${medicationCsvTemplate()}CAT-001,Generic one,,Tablet,1 mg,12.50\ncat-001,Generic two,,Tablet,2 mg,25.00\n`);
    expect(preview.validRows).toHaveLength(1);
    expect(preview.invalidRows).toEqual([{ rowNumber: 3, message: "พบ code ซ้ำในไฟล์: CAT-001" }]);
  });
});
