import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { medicationCsvTemplate, parseMedicationCatalogCsv, type MedicationCsvPreview } from "@/lib/medicationCsv";
import { AccessDenied } from "@/pages/FrontDesk";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  CircleDollarSign,
  Download,
  Edit2,
  FileUp,
  Filter,
  PackagePlus,
  Plus,
  ShieldCheck,
  TriangleAlert,
  Upload,
} from "lucide-react";
import { type ChangeEvent, type FormEvent, useRef, useState } from "react";

type MedicationForm = {
  code: string;
  genericName: string;
  tradeName: string;
  dosageForm: string;
  strength: string;
  priceBaht: string;
};
const initialMedication: MedicationForm = {
  code: "",
  genericName: "",
  tradeName: "",
  dosageForm: "",
  strength: "",
  priceBaht: "",
};

function moneyToSatang(value: string) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0 ? Math.round(numberValue * 100) : null;
}

function downloadTemplate() {
  const blob = new Blob([medicationCsvTemplate()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "medication-catalog-template.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function MedicationCatalog() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [medication, setMedication] = useState<MedicationForm>(initialMedication);
  const [pricing, setPricing] = useState({ medicationId: "", priceBaht: "" });
  const [lot, setLot] = useState({ medicationId: "", lotNumber: "", expiryDate: "", quantity: "" });
  const [editingThreshold, setEditingThreshold] = useState<{ id: number; code: string; name: string; threshold: string } | null>(null);
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<MedicationCsvPreview | null>(null);
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canManage = user?.role === "SYSTEM_ADMIN";
  const catalog = trpc.pharmacy.catalog.search.useQuery({ query: searchQuery }, { enabled: canManage });
  const createMedication = trpc.pharmacy.catalog.create.useMutation();
  const setUnitPrice = trpc.pharmacy.catalog.setUnitPrice.useMutation();
  const updateMinStock = trpc.pharmacy.catalog.updateMinStock.useMutation();
  const receiveLot = trpc.pharmacy.catalog.receiveLot.useMutation();
  const bulkImport = trpc.pharmacy.catalog.bulkImport.useMutation();

  if (!canManage) {
    return (
      <AccessDenied
        title="คลังยาและราคา"
        detail="ข้อมูลยาและราคาตั้งต้นเป็น master data สำหรับผู้ดูแลระบบเท่านั้น โดยหน้าอื่นจะเห็นเฉพาะข้อมูลที่จำเป็นต่อ workflow"
      />
    );
  }

  async function submitMedication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const unitPriceSatang = moneyToSatang(medication.priceBaht);
    if (unitPriceSatang === null) {
      setError("กรุณาระบุราคาต่อหน่วยเป็นตัวเลขตั้งแต่ 0 บาทขึ้นไป");
      return;
    }
    try {
      const created = await createMedication.mutateAsync({
        code: medication.code,
        genericName: medication.genericName,
        tradeName: medication.tradeName || undefined,
        dosageForm: medication.dosageForm,
        strength: medication.strength,
      });
      await setUnitPrice.mutateAsync({ medicationId: created.id, unitPriceSatang });
      setMedication(initialMedication);
      setNotice("เพิ่มรายการยาและราคาที่ใช้งานแล้ว");
      await utils.pharmacy.catalog.search.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถเพิ่มรายการยาได้");
    }
  }

  async function submitLot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const medicationId = Number(lot.medicationId);
    const quantity = Number(lot.quantity);
    if (!Number.isInteger(medicationId) || !Number.isInteger(quantity) || quantity < 1) {
      setError("กรุณาเลือกรายการยาและระบุจำนวนเต็มที่มากกว่า 0");
      return;
    }
    try {
      await receiveLot.mutateAsync({
        medicationId,
        lotNumber: lot.lotNumber,
        expiryDate: lot.expiryDate,
        quantity,
        idempotencyKey: crypto.randomUUID(),
      });
      setLot({ medicationId: "", lotNumber: "", expiryDate: "", quantity: "" });
      setNotice("รับสต็อกเข้าคลังแล้ว");
      await utils.pharmacy.catalog.search.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถรับสต็อกได้");
    }
  }

  async function submitPrice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    const medicationId = Number(pricing.medicationId);
    const unitPriceSatang = moneyToSatang(pricing.priceBaht);
    if (!Number.isInteger(medicationId) || unitPriceSatang === null) {
      setError("กรุณาเลือกรายการยาและระบุราคาต่อหน่วยที่ถูกต้อง");
      return;
    }
    try {
      await setUnitPrice.mutateAsync({ medicationId, unitPriceSatang });
      setPricing({ medicationId: "", priceBaht: "" });
      setNotice("ตั้งราคา active สำหรับการจ่ายครั้งถัดไปแล้ว");
      await utils.pharmacy.catalog.search.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถตั้งราคายาได้");
    }
  }

  async function submitUpdateThreshold(e: FormEvent) {
    e.preventDefault();
    if (!editingThreshold) return;
    const threshold = Number(editingThreshold.threshold);
    if (!Number.isInteger(threshold) || threshold < 0) {
      setError("กรุณาระบุจุดสั่งซื้อขั้นต่ำเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await updateMinStock.mutateAsync({
        medicationId: editingThreshold.id,
        minStockThreshold: threshold,
      });
      setEditingThreshold(null);
      setNotice(`ปรับจุดสั่งซื้อขั้นต่ำของ ${editingThreshold.code} เรียบร้อยแล้ว`);
      await utils.pharmacy.catalog.search.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถแก้ไขจุดสั่งซื้อได้");
    }
  }

  async function handleCsvFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(null);
    setNotice(null);
    setCsvPreview(null);
    setCsvFileName(null);
    if (file.size > 1_000_000) {
      setError("ไฟล์ CSV ต้องมีขนาดไม่เกิน 1 MB และไม่เกิน 200 รายการ");
      return;
    }
    try {
      const preview = parseMedicationCatalogCsv(await file.text());
      if (preview.totalRows > 200) {
        setError("ไฟล์ CSV มีมากกว่า 200 รายการ กรุณาแบ่งเป็นหลายไฟล์");
        return;
      }
      setCsvPreview(preview);
      setCsvFileName(file.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถอ่านไฟล์ CSV ได้");
    }
  }

  async function confirmCsvImport() {
    if (!csvPreview || csvPreview.invalidRows.length > 0 || csvPreview.validRows.length === 0) return;
    setError(null);
    setNotice(null);
    try {
      const result = await bulkImport.mutateAsync({
        rows: csvPreview.validRows.map(({ rowNumber, pricePerUnit, tradeName, ...row }) => ({
          ...row,
          tradeName: tradeName ?? undefined,
        })),
      });
      setCsvPreview(null);
      setCsvFileName(null);
      setNotice(`นำเข้ายาและราคา ${result.importedCount} รายการแล้ว`);
      await utils.pharmacy.catalog.search.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถนำเข้าข้อมูลยาได้");
    }
  }

  const allItems = catalog.data ?? [];
  const lowStockCount = allItems.filter(item => item.isLowStock).length;
  const filteredItems = filterLowStockOnly ? allItems.filter(item => item.isLowStock) : allItems;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 text-[#17312F]">
      <header className="rounded-[22px] border border-[#D5E3DD] bg-[#EAF4F0] px-5 py-5 sm:px-7">
        <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-[#0B6B67]">
          SYSTEM ADMIN / NON-PHI MASTER DATA
        </p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">คลังยา ราคา และจุดสั่งซื้อ</h1>
            <p className="mt-1 text-sm text-[#5C726C]">
              เพิ่มรายการยา ตั้งราคา active กำหนดจุดสั่งซื้อขั้นต่ำ (Reorder Point) และตรวจนับสต็อกคงเหลือ
            </p>
          </div>
          <ShieldCheck className="text-[#0B6B67]" size={28} />
        </div>
      </header>

      {(error || notice) && (
        <p
          role={error ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-sm ${
            error ? "border-[#E7C9C1] bg-[#FFF3F0] text-[#A13C2F]" : "border-[#CBE1D8] bg-[#F2F8F5] text-[#276451]"
          }`}
        >
          {error || notice}
        </p>
      )}

      {/* CSV Import Section */}
      <section className="rounded-[20px] border border-[#BFDCD1] bg-[#F6FBF8] p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#DDF0EA] text-[#0B6B67]">
              <FileUp size={19} />
            </span>
            <div>
              <h2 className="font-semibold">นำเข้ายาและราคา จาก CSV</h2>
              <p className="mt-1 text-xs leading-5 text-[#526861]">
                เพิ่มรายการใหม่พร้อมราคา active ครั้งแรก ระบบตรวจข้อมูลทั้งหมดก่อนบันทึก และจะไม่บันทึกหากมีแถวใดผิดพลาดหรือรหัสยาซ้ำ
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[#0B6B67] bg-white px-3 text-sm font-semibold text-[#0B6B67] transition hover:bg-[#F0F8F5]"
          >
            <Download size={16} />
            ดาวน์โหลด Template
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-dashed border-[#9BC9BA] bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#17312F]">
              คอลัมน์: code, genericName, tradeName, dosageForm, strength, pricePerUnit
            </p>
            <p className="mt-1 text-xs text-[#71837E]">
              tradeName เว้นว่างได้ · pricePerUnit เป็นบาท ทศนิยมได้ไม่เกิน 2 ตำแหน่ง · template ไม่มีข้อมูลตัวอย่าง
            </p>
          </div>
          <input ref={fileInputRef} onChange={handleCsvFile} accept=".csv,text/csv" type="file" className="sr-only" />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#17312F] px-3 text-sm font-semibold text-white transition hover:bg-[#244942]"
          >
            <Upload size={16} />
            เลือกไฟล์ CSV
          </button>
        </div>

        {csvPreview ? (
          <div className="mt-4 rounded-xl border border-[#D5E3DD] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">ตัวอย่างก่อนบันทึก{csvFileName ? ` · ${csvFileName}` : ""}</p>
                <p className="mt-1 text-xs text-[#71837E]">
                  พบ {csvPreview.totalRows} แถว · ผ่าน {csvPreview.validRows.length} แถว · ต้องแก้ไข {csvPreview.invalidRows.length} แถว
                </p>
              </div>
              {csvPreview.invalidRows.length === 0 ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EAF7F0] px-3 py-1 text-xs font-semibold text-[#276451]">
                  <CheckCircle2 size={14} />
                  พร้อมบันทึก
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF3E8] px-3 py-1 text-xs font-semibold text-[#A85A22]">
                  <TriangleAlert size={14} />
                  แก้ไขไฟล์ก่อน
                </span>
              )}
            </div>

            {csvPreview.validRows.length > 0 ? (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-xs">
                  <thead className="border-b border-[#E1E8E3] text-[#71837E]">
                    <tr>
                      <th className="pb-2">แถว</th>
                      <th className="pb-2">รหัส</th>
                      <th className="pb-2">ชื่อสามัญ</th>
                      <th className="pb-2">รูปแบบ / ความแรง</th>
                      <th className="pb-2">ราคา (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.validRows.slice(0, 10).map(row => (
                      <tr key={row.rowNumber} className="border-b border-[#EEF2EF]">
                        <td className="py-2">{row.rowNumber}</td>
                        <td className="py-2 font-mono text-[#0B6B67]">{row.code}</td>
                        <td className="py-2">{row.genericName}</td>
                        <td className="py-2">{row.dosageForm} · {row.strength}</td>
                        <td className="py-2">{row.pricePerUnit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvPreview.validRows.length > 10 ? (
                  <p className="mt-2 text-xs text-[#71837E]">แสดง 10 แถวแรกจากรายการที่ผ่านการตรวจสอบ</p>
                ) : null}
              </div>
            ) : null}

            {csvPreview.invalidRows.length > 0 ? (
              <ul className="mt-4 space-y-1 rounded-lg bg-[#FFF8F3] p-3 text-xs text-[#9A4E22]">
                {csvPreview.invalidRows.slice(0, 10).map(issue => (
                  <li key={`${issue.rowNumber}-${issue.message}`}>
                    แถว {issue.rowNumber}: {issue.message}
                  </li>
                ))}
                {csvPreview.invalidRows.length > 10 ? (
                  <li>และมีข้อผิดพลาดเพิ่มเติมอีก {csvPreview.invalidRows.length - 10} แถว</li>
                ) : null}
              </ul>
            ) : null}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCsvPreview(null);
                  setCsvFileName(null);
                }}
                className="h-10 rounded-lg border border-[#D7E1DB] px-3 text-sm font-semibold text-[#526861]"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={bulkImport.isPending || csvPreview.invalidRows.length > 0 || csvPreview.validRows.length === 0}
                onClick={confirmCsvImport}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#0B6B67] px-3 text-sm font-semibold text-white transition hover:bg-[#095B58] disabled:cursor-not-allowed disabled:opacity-55"
              >
                <FileUp size={16} />
                {bulkImport.isPending ? "กำลังบันทึก…" : `ยืนยันนำเข้า ${csvPreview.validRows.length} รายการ`}
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* 3-Column Action Forms */}
      <div className="grid gap-5 xl:grid-cols-3">
        {/* Create Medication Form */}
        <section className="rounded-[20px] border border-[#DCE5DF] bg-white p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#DDF0EA] text-[#0B6B67]">
              <Plus size={19} />
            </span>
            <div>
              <h2 className="font-semibold">เพิ่มยาและราคา</h2>
              <p className="text-xs text-[#71837E]">ราคาที่กำหนดจะใช้เมื่อมีการจ่ายยาในอนาคต</p>
            </div>
          </div>
          <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={submitMedication}>
            {(
              [
                ["code", "รหัสยา"],
                ["genericName", "ชื่อสามัญ"],
                ["tradeName", "ชื่อการค้า (ถ้ามี)"],
                ["dosageForm", "รูปแบบยา"],
                ["strength", "ความแรง"],
                ["priceBaht", "ราคาต่อหน่วย (บาท)"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="block">
                <span className="mb-1 block text-xs font-semibold text-[#526861]">{label}</span>
                <input
                  required={field !== "tradeName"}
                  inputMode={field === "priceBaht" ? "decimal" : undefined}
                  value={medication[field]}
                  onChange={event => setMedication(current => ({ ...current, [field]: event.target.value }))}
                  className="h-10 w-full rounded-lg border border-[#D7E1DB] px-3 text-sm outline-none focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10"
                />
              </label>
            ))}
            <button
              disabled={createMedication.isPending || setUnitPrice.isPending}
              className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#17312F] px-4 text-sm font-semibold text-white transition hover:bg-[#244942] disabled:opacity-55 sm:col-span-2"
            >
              <CircleDollarSign size={16} />
              {createMedication.isPending || setUnitPrice.isPending ? "กำลังบันทึก…" : "บันทึกยาและราคา"}
            </button>
          </form>
        </section>

        {/* Set Active Unit Price Form */}
        <section className="rounded-[20px] border border-[#DCE5DF] bg-white p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF4F0] text-[#0B6B67]">
              <CircleDollarSign size={19} />
            </span>
            <div>
              <h2 className="font-semibold">ตั้งราคา active</h2>
              <p className="text-xs text-[#71837E]">เพิ่มราคาล่าสุดสำหรับยาที่บันทึกไว้แล้ว</p>
            </div>
          </div>
          <form className="mt-5 grid gap-3" onSubmit={submitPrice}>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-[#526861]">รายการยา</span>
              <select
                required
                value={pricing.medicationId}
                onChange={event => setPricing(current => ({ ...current, medicationId: event.target.value }))}
                className="h-10 w-full rounded-lg border border-[#D7E1DB] bg-white px-3 text-sm outline-none focus:border-[#0B6B67]"
              >
                <option value="">เลือกยาที่บันทึกไว้</option>
                {catalog.data?.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.genericName} {item.strength}
                  </option>
                ))}
              </select>
            </label>
            <Field
              label="ราคาต่อหน่วยใหม่ (บาท)"
              inputMode="numeric"
              value={pricing.priceBaht}
              onChange={value => setPricing(current => ({ ...current, priceBaht: value }))}
            />
            <button
              disabled={setUnitPrice.isPending}
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#0B6B67] px-4 text-sm font-semibold text-[#0B6B67] transition hover:bg-[#F0F8F5] disabled:opacity-55"
            >
              <CircleDollarSign size={16} />
              {setUnitPrice.isPending ? "กำลังตั้งราคา…" : "บันทึกราคา active"}
            </button>
          </form>
        </section>

        {/* Receive Inventory Lot Form */}
        <section className="rounded-[20px] border border-[#DCE5DF] bg-white p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF0E8] text-[#BA5939]">
              <PackagePlus size={19} />
            </span>
            <div>
              <h2 className="font-semibold">รับสต็อกตาม lot</h2>
              <p className="text-xs text-[#71837E]">ระบบใช้ lot ที่หมดอายุก่อนเมื่อจ่ายยา (FEFO)</p>
            </div>
          </div>
          <form className="mt-5 grid gap-3 sm:grid-cols-2" onSubmit={submitLot}>
            <label className="block sm:col-span-2">
              <span className="mb-1 block text-xs font-semibold text-[#526861]">รายการยา</span>
              <select
                required
                value={lot.medicationId}
                onChange={event => setLot(current => ({ ...current, medicationId: event.target.value }))}
                className="h-10 w-full rounded-lg border border-[#D7E1DB] bg-white px-3 text-sm outline-none focus:border-[#0B6B67]"
              >
                <option value="">เลือกยาที่บันทึกไว้</option>
                {catalog.data?.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.code} · {item.genericName} {item.strength}
                  </option>
                ))}
              </select>
            </label>
            <Field label="เลข lot" value={lot.lotNumber} onChange={value => setLot(current => ({ ...current, lotNumber: value }))} />
            <Field label="วันหมดอายุ" type="date" value={lot.expiryDate} onChange={value => setLot(current => ({ ...current, expiryDate: value }))} />
            <Field label="จำนวนรับเข้า" inputMode="numeric" value={lot.quantity} onChange={value => setLot(current => ({ ...current, quantity: value }))} />
            <button
              disabled={receiveLot.isPending}
              className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#0B6B67] px-4 text-sm font-semibold text-[#0B6B67] transition hover:bg-[#F0F8F5] disabled:opacity-55"
            >
              <Boxes size={16} />
              {receiveLot.isPending ? "กำลังรับสต็อก…" : "รับสต็อกเข้าคลัง"}
            </button>
          </form>
        </section>
      </div>

      {/* Medication Catalog & Stock Level Table */}
      <section className="rounded-[20px] border border-[#DCE5DF] bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EAF0EC] pb-4">
          <div className="flex items-center gap-3">
            <Boxes className="text-[#0B6B67]" size={20} />
            <div>
              <h2 className="font-semibold text-lg">รายการยา สต็อกคงเหลือ และจุดสั่งซื้อ</h2>
              <p className="text-xs text-[#71837E]">
                แสดงยอดคงเหลือจริงจาก Lot และแจ้งเตือนเมื่อยอดรวมต่ำกว่าจุดสั่งซื้อขั้นต่ำ
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {lowStockCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterLowStockOnly(prev => !prev)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                  filterLowStockOnly
                    ? "border-[#EF4444] bg-[#FEF2F2] text-[#DC2626]"
                    : "border-[#FCA5A5] bg-white text-[#DC2626] hover:bg-[#FEF2F2]"
                }`}
              >
                <AlertTriangle size={14} />
                <span>ยาใกล้หมด ({lowStockCount} รายการ)</span>
              </button>
            )}
            <input
              type="search"
              placeholder="ค้นหารหัส หรือชื่อยา…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 rounded-xl border border-[#D7E1DB] px-3 text-xs outline-none focus:border-[#0B6B67]"
            />
          </div>
        </div>

        {catalog.isLoading ? (
          <p className="py-8 text-center text-sm text-[#60756E]">กำลังโหลดข้อมูล catalog…</p>
        ) : !filteredItems.length ? (
          <p className="py-8 text-center text-sm text-[#60756E]">
            {filterLowStockOnly ? "ไม่มีรายการยาที่สต็อกต่ำกว่าเกณฑ์" : "ยังไม่มีรายการยา เริ่มจากเพิ่มยาและราคาในแบบฟอร์มด้านบน"}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-[#E1E8E3] text-xs text-[#71837E]">
                <tr>
                  <th className="pb-3 font-semibold">รหัส</th>
                  <th className="pb-3 font-semibold">ชื่อยา</th>
                  <th className="pb-3 font-semibold">รูปแบบ / ความแรง</th>
                  <th className="pb-3 font-semibold text-center">จุดสั่งซื้อขั้นต่ำ (Reorder)</th>
                  <th className="pb-3 font-semibold text-center">คงเหลือในคลัง</th>
                  <th className="pb-3 font-semibold text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map(item => (
                  <tr key={item.id} className="border-b border-[#EEF2EF] hover:bg-[#F9FBFA]">
                    <td className="py-3 font-mono text-xs font-bold text-[#0B6B67]">{item.code}</td>
                    <td className="py-3 font-semibold">
                      {item.genericName}
                      {item.tradeName ? <span className="ml-2 font-normal text-[#71837E]">({item.tradeName})</span> : null}
                    </td>
                    <td className="py-3 text-[#526861]">
                      {item.dosageForm} · {item.strength}
                    </td>
                    <td className="py-3 text-center">
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-[#526861]">
                        {item.minStockThreshold}
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      {item.onHandQuantity === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF2F2] px-2.5 py-0.5 text-xs font-bold text-[#DC2626]">
                          ❌ หมดสต็อก (0)
                        </span>
                      ) : item.isLowStock ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#FFFBEB] px-2.5 py-0.5 text-xs font-bold text-[#D97706]">
                          ⚠️ ต่ำกว่าเกณฑ์ ({item.onHandQuantity})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F0FDF4] px-2.5 py-0.5 text-xs font-bold text-[#16A34A]">
                          ✅ มีพร้อมจ่าย ({item.onHandQuantity})
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setEditingThreshold({
                            id: item.id,
                            code: item.code,
                            name: item.genericName,
                            threshold: String(item.minStockThreshold),
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg border border-[#D5E3DD] bg-white px-2.5 py-1 text-xs font-semibold text-[#526861] transition hover:border-[#0B6B67] hover:text-[#0B6B67]"
                      >
                        <Edit2 size={12} /> ปรับเกณฑ์
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Edit Min Stock Threshold Modal */}
      {editingThreshold && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="font-bold text-lg text-[#17312F]">
              ปรับจุดสั่งซื้อขั้นต่ำ (Reorder Point)
            </h3>
            <p className="mt-1 text-xs text-[#71837E]">
              {editingThreshold.code} · {editingThreshold.name}
            </p>

            <form onSubmit={submitUpdateThreshold} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#526861] mb-1">
                  จำนวนคงเหลือขั้นต่ำเพื่อแจ้งเตือน
                </label>
                <input
                  required
                  type="number"
                  min="0"
                  value={editingThreshold.threshold}
                  onChange={e =>
                    setEditingThreshold(prev => (prev ? { ...prev, threshold: e.target.value } : null))
                  }
                  className="h-10 w-full rounded-lg border border-[#BBD8CE] px-3 text-sm outline-none focus:border-[#0B6B67]"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingThreshold(null)}
                  className="rounded-xl border border-[#D7E1DB] px-4 py-2 text-xs font-semibold text-[#526861]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={updateMinStock.isPending}
                  className="rounded-xl bg-[#0B6B67] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#095956] disabled:opacity-50"
                >
                  {updateMinStock.isPending ? "กำลังบันทึก…" : "บันทึก"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  inputMode?: "numeric";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-[#526861]">{label}</span>
      <input
        required
        type={type}
        inputMode={inputMode}
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-[#D7E1DB] px-3 text-sm outline-none focus:border-[#0B6B67]"
      />
    </label>
  );
}
