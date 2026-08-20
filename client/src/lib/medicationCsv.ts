export const medicationCsvHeaders = ["code", "genericName", "tradeName", "dosageForm", "strength", "pricePerUnit"] as const;

type MedicationCsvColumn = (typeof medicationCsvHeaders)[number];

export type MedicationImportRow = {
  rowNumber: number;
  code: string;
  genericName: string;
  tradeName: string | null;
  dosageForm: string;
  strength: string;
  unitPriceSatang: number;
  pricePerUnit: string;
};

export type MedicationImportIssue = {
  rowNumber: number;
  message: string;
};

export type MedicationCsvPreview = {
  validRows: MedicationImportRow[];
  invalidRows: MedicationImportIssue[];
  totalRows: number;
};

function parseCsvRecords(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (inQuotes && source[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === "," && !inQuotes) {
      row.push(value);
      value = "";
    } else if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else {
      value += character;
    }
  }

  if (inQuotes) throw new Error("ไฟล์ CSV มีเครื่องหมายอัญประกาศเปิดค้างอยู่");
  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

function isMoney(value: string) {
  return /^\d+(?:\.\d{1,2})?$/.test(value);
}

function toSatang(value: string) {
  return Math.round(Number(value) * 100);
}

function getCell(record: string[], headerIndexes: Map<MedicationCsvColumn, number>, column: MedicationCsvColumn) {
  return (record[headerIndexes.get(column) ?? -1] ?? "").trim();
}

export function parseMedicationCatalogCsv(source: string): MedicationCsvPreview {
  const records = parseCsvRecords(source.replace(/^\uFEFF/, ""));
  const [headerRecord, ...dataRecords] = records;
  if (!headerRecord) throw new Error("ไม่พบแถวหัวตารางในไฟล์ CSV");

  const normalizedHeaders = headerRecord.map(header => header.trim());
  const headerIndexes = new Map<MedicationCsvColumn, number>();
  for (const column of medicationCsvHeaders) {
    const headerIndex = normalizedHeaders.indexOf(column);
    if (headerIndex < 0) throw new Error(`ไฟล์ CSV ต้องมีคอลัมน์ ${medicationCsvHeaders.join(", ")}`);
    headerIndexes.set(column, headerIndex);
  }

  const validRows: MedicationImportRow[] = [];
  const invalidRows: MedicationImportIssue[] = [];
  const knownCodes = new Set<string>();
  let totalRows = 0;

  dataRecords.forEach((record, recordIndex) => {
    if (record.every(value => value.trim() === "")) return;
    totalRows += 1;
    const rowNumber = recordIndex + 2;
    const code = getCell(record, headerIndexes, "code").toUpperCase();
    const genericName = getCell(record, headerIndexes, "genericName");
    const tradeName = getCell(record, headerIndexes, "tradeName");
    const dosageForm = getCell(record, headerIndexes, "dosageForm");
    const strength = getCell(record, headerIndexes, "strength");
    const pricePerUnit = getCell(record, headerIndexes, "pricePerUnit");

    if (!code || !genericName || !dosageForm || !strength || !pricePerUnit) {
      invalidRows.push({ rowNumber, message: "กรอก code, genericName, dosageForm, strength และ pricePerUnit ให้ครบ" });
      return;
    }
    if (code.length > 64 || genericName.length > 255 || tradeName.length > 255 || dosageForm.length > 120 || strength.length > 120) {
      invalidRows.push({ rowNumber, message: "ข้อมูลบางคอลัมน์ยาวเกินกว่าระบบรองรับ" });
      return;
    }
    if (!isMoney(pricePerUnit) || toSatang(pricePerUnit) > 100_000_000) {
      invalidRows.push({ rowNumber, message: "pricePerUnit ต้องเป็นจำนวนเงินตั้งแต่ 0.00 ถึง 1,000,000.00" });
      return;
    }
    if (knownCodes.has(code)) {
      invalidRows.push({ rowNumber, message: `พบ code ซ้ำในไฟล์: ${code}` });
      return;
    }
    knownCodes.add(code);
    validRows.push({ rowNumber, code, genericName, tradeName: tradeName || null, dosageForm, strength, pricePerUnit, unitPriceSatang: toSatang(pricePerUnit) });
  });

  if (totalRows === 0) throw new Error("ไฟล์ CSV ไม่มีข้อมูลยาให้ตรวจสอบ");
  return { validRows, invalidRows, totalRows };
}

export function medicationCsvTemplate() {
  return `${medicationCsvHeaders.join(",")}\r\n`;
}
