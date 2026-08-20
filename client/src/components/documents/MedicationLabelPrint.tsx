import { Printer, X } from "lucide-react";
import React, { useState } from "react";

export type MedicationLabelItem = {
  id: number;
  medicationNameSnapshot: string;
  strengthSnapshot: string;
  dose: string;
  frequency: string;
  duration?: string | null;
  quantityPrescribed: number;
  instructions?: string | null;
};

export type MedicationLabelPrintProps = {
  patient: {
    hn: string;
    firstName: string;
    lastName: string;
    allergySummary?: string | null;
  };
  visitDate?: string;
  items: MedicationLabelItem[];
  onClose: () => void;
};

function formatThaiDate(dateStr?: string) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return Number.isNaN(d.getTime())
    ? new Date().toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })
    : d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default function MedicationLabelPrint({ patient, visitDate, items, onClose }: MedicationLabelPrintProps) {
  const [layoutMode, setLayoutMode] = useState<"a4-grid" | "individual">("a4-grid");

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:p-0 print:bg-white print:fixed print:inset-0">
      {/* Control bar - hidden during print */}
      <div className="flex h-full max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl print:max-h-none print:w-full print:rounded-none print:shadow-none">
        <header className="flex items-center justify-between border-b border-[#D5E3DD] bg-[#EAF4F0] px-6 py-4 print:hidden">
          <div>
            <h2 className="text-lg font-bold text-[#17312F]">พิมพ์ฉลากยา (กระดาษสติกเกอร์ไดคัท A4)</h2>
            <p className="text-xs text-[#5C726C]">
              {patient.hn} — {patient.firstName} {patient.lastName} ({items.length} รายการ)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-[#BBD8CE] bg-white p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLayoutMode("a4-grid")}
                className={`rounded-md px-3 py-1.5 transition ${layoutMode === "a4-grid" ? "bg-[#0B6B67] text-white" : "text-[#5C726C] hover:text-[#17312F]"}`}
              >
                สติกเกอร์ A4 (ตาราง 2×4)
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode("individual")}
                className={`rounded-md px-3 py-1.5 transition ${layoutMode === "individual" ? "bg-[#0B6B67] text-white" : "text-[#5C726C] hover:text-[#17312F]"}`}
              >
                ฉลากเดี่ยว
              </button>
            </div>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0B6B67] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#095956] active:scale-95"
            >
              <Printer size={16} /> พิมพ์ฉลาก
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#D5E3DD] p-2 text-[#5C726C] transition hover:bg-[#D5E3DD]/40"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Print Content Preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F4F6F5] print:overflow-visible print:bg-white print:p-0">
          {!items.length ? (
            <p className="p-8 text-center text-sm text-[#71837E]">ไม่มีรายการยาสำหรับการพิมพ์ฉลาก</p>
          ) : layoutMode === "a4-grid" ? (
            <div className="mx-auto max-w-[210mm] bg-white p-[10mm] shadow-lg print:max-w-none print:p-0 print:shadow-none">
              <div className="grid grid-cols-2 gap-[6mm] print:grid-cols-2 print:gap-[6mm]">
                {items.map((item, idx) => (
                  <div
                    key={item.id || idx}
                    className="relative flex flex-col justify-between rounded-lg border-2 border-dashed border-[#9AB8AF] p-4 text-[#17312F] print:border print:border-solid print:border-black"
                    style={{ minHeight: "68mm" }}
                  >
                    <div>
                      {/* Clinic Header */}
                      <div className="border-b border-[#D5E3DD] pb-1.5 text-center print:border-black">
                        <p className="text-xs font-bold text-[#0B6B67] print:text-black">คลินิกเวชกรรมหมอพัลลภ</p>
                        <p className="text-[10px] text-[#5C726C] print:text-black">โทร. 02-xxx-xxxx</p>
                      </div>

                      {/* Patient & Date */}
                      <div className="mt-1.5 flex justify-between text-[11px] font-semibold border-b border-[#EAF0ED] pb-1 print:border-black">
                        <span>HN: <strong className="font-mono">{patient.hn}</strong></span>
                        <span>{formatThaiDate(visitDate)}</span>
                      </div>
                      <p className="mt-0.5 text-xs font-bold truncate">
                        ผู้รับบริการ: {patient.firstName} {patient.lastName}
                      </p>

                      {/* Medication Name */}
                      <div className="mt-2 rounded bg-[#F0F8F5] p-1.5 print:bg-transparent print:border print:border-gray-300">
                        <p className="text-sm font-black text-[#0B6B67] print:text-black leading-tight">
                          {item.medicationNameSnapshot}
                        </p>
                        <p className="text-xs font-semibold text-[#3B544E] print:text-black">
                          ขนาดความแรง: {item.strengthSnapshot} | จำนวน: {item.quantityPrescribed}
                        </p>
                      </div>

                      {/* Instructions */}
                      <div className="mt-2 text-xs font-medium space-y-0.5">
                        <p className="font-bold text-[#17312F]">
                          วิธีใช้: {item.dose} {item.frequency}
                        </p>
                        {item.instructions && (
                          <p className="text-[11px] text-[#425953] print:text-black">
                            คำแนะนำ: {item.instructions}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Footer / Precautions */}
                    <div className="mt-2 border-t border-[#D5E3DD] pt-1 text-[9px] text-[#71837E] flex justify-between print:border-black print:text-black">
                      <span>* เก็บในที่แห้ง พ้นแสงแดด</span>
                      <span>ผู้จัดยา: ....................</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-md space-y-4">
              {items.map((item, idx) => (
                <div
                  key={item.id || idx}
                  className="rounded-xl border border-[#9AB8AF] bg-white p-5 shadow-sm print:break-inside-avoid print:border-black"
                >
                  <div className="border-b border-[#D5E3DD] pb-2 text-center">
                    <p className="text-sm font-bold text-[#0B6B67]">คลินิกเวชกรรมหมอพัลลภ</p>
                    <p className="text-xs text-[#5C726C]">โทร. 02-xxx-xxxx</p>
                  </div>
                  <div className="mt-2 flex justify-between text-xs font-semibold">
                    <span>HN: {patient.hn}</span>
                    <span>{formatThaiDate(visitDate)}</span>
                  </div>
                  <p className="mt-1 text-sm font-bold">
                    ชื่อ: {patient.firstName} {patient.lastName}
                  </p>
                  <div className="mt-3 rounded-lg bg-[#F0F8F5] p-2.5">
                    <p className="text-base font-bold text-[#0B6B67]">{item.medicationNameSnapshot}</p>
                    <p className="text-xs font-semibold text-[#3B544E]">
                      {item.strengthSnapshot} — จำนวน {item.quantityPrescribed}
                    </p>
                  </div>
                  <div className="mt-2 text-xs space-y-1">
                    <p className="font-semibold">วิธีใช้: {item.dose} · {item.frequency}</p>
                    {item.instructions && <p className="text-[#5C726C]">คำแนะนำ: {item.instructions}</p>}
                  </div>
                  <div className="mt-3 border-t border-[#D5E3DD] pt-1.5 text-[10px] text-[#71837E] flex justify-between">
                    <span>* เก็บในที่แห้ง พ้นแสงแดด</span>
                    <span>ผู้จัดยา: ....................</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
