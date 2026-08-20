import { satangToThaiBahtText } from "@shared/bahtText";
import { Printer, X } from "lucide-react";
import React from "react";

export type InvoicePrintLine = {
  id: number;
  sourceType: string;
  descriptionSnapshot: string;
  quantity: number;
  unitPriceSatang: number;
  lineTotalSatang: number;
};

export type InvoiceReceiptPrintProps = {
  invoice: {
    invoiceNumber: string;
    totalSatang: number;
    issuedAt?: string | Date | null;
    paidAt?: string | Date | null;
    status: string;
  };
  patient: {
    hn: string;
    firstName: string;
    lastName: string;
  };
  lines: InvoicePrintLine[];
  paymentMethod?: "CASH" | "PROMPTPAY" | "EXTERNAL_REFERENCE" | "CREDIT_CARD";
  externalReference?: string | null;
  cashierName?: string;
  onClose: () => void;
};

const formatBaht = (satang: number) =>
  new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(satang / 100);

function formatThaiDateTime(dateVal?: string | Date | null) {
  const d = dateVal ? new Date(dateVal) : new Date();
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function InvoiceReceiptPrint({
  invoice,
  patient,
  lines,
  paymentMethod = "CASH",
  externalReference,
  cashierName = "เจ้าหน้าที่การเงิน",
  onClose,
}: InvoiceReceiptPrintProps) {
  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="flex h-full max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl print:max-h-none print:w-full print:rounded-none print:shadow-none">
        {/* Header - Hidden on Print */}
        <header className="flex items-center justify-between border-b border-[#D5E3DD] bg-[#EAF4F0] px-6 py-4 print:hidden">
          <div>
            <h2 className="text-lg font-bold text-[#17312F]">พิมพ์ใบเสร็จรับเงิน / ใบสรุปรายการยา (กระดาษ A5)</h2>
            <p className="text-xs text-[#5C726C]">
              {invoice.invoiceNumber} — {patient.hn} ({patient.firstName} {patient.lastName})
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0B6B67] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#095956] active:scale-95"
            >
              <Printer size={16} /> พิมพ์ใบเสร็จ (A5)
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

        {/* Printable A5 Document Preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F4F6F5] print:overflow-visible print:bg-white print:p-0">
          <div className="mx-auto max-w-[148mm] min-h-[210mm] bg-white p-[10mm] shadow-lg border border-[#D5E3DD] text-[#17312F] print:max-w-none print:min-h-0 print:border-none print:p-0 print:shadow-none">
            {/* Clinic Header */}
            <div className="text-center border-b-2 border-[#17312F] pb-3">
              <h1 className="text-lg font-bold tracking-tight text-[#0B6B67] print:text-black">
                คลินิกเวชกรรมหมอพัลลภ
              </h1>
              <p className="text-[11px] text-[#5C726C] print:text-black">
                123/45 ถนนสุขภาพดี ตำบลในเมือง อำเภอเมือง จังหวัดนนทบุรี 11000 · โทร. 02-xxx-xxxx
              </p>
              <p className="text-[10px] text-[#71837E] print:text-black">
                เลขที่ใบอนุญาตประกอบกิจการสถานพยาบาล: 1010100001
              </p>
              <div className="mt-2 inline-block border border-[#17312F] px-4 py-1 font-bold text-xs">
                ใบเสร็จรับเงิน / ใบสรุปรายการยาและค่าบริการ (RECEIPT)
              </div>
            </div>

            {/* Invoice & Patient Info */}
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-b border-[#D5E3DD] pb-3 print:border-black">
              <div>
                <p>
                  <strong>เลขที่ใบเสร็จ:</strong> <span className="font-mono font-bold">{invoice.invoiceNumber}</span>
                </p>
                <p className="mt-1">
                  <strong>วันที่ออก:</strong> {formatThaiDateTime(invoice.issuedAt || invoice.paidAt)}
                </p>
              </div>
              <div className="text-right">
                <p>
                  <strong>HN:</strong> <span className="font-mono font-bold">{patient.hn}</span>
                </p>
                <p className="mt-1 font-bold truncate">
                  ผู้รับบริการ: {patient.firstName} {patient.lastName}
                </p>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="mt-3">
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#17312F] text-[11px] font-bold">
                    <th className="py-1.5 w-8">ลำดับ</th>
                    <th className="py-1.5">รายการ</th>
                    <th className="py-1.5 text-center w-14">ประเภท</th>
                    <th className="py-1.5 text-center w-12">จำนวน</th>
                    <th className="py-1.5 text-right w-16">ราคา/หน่วย</th>
                    <th className="py-1.5 text-right w-20">จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAF0ED] print:divide-gray-300">
                  {lines.map((line, idx) => (
                    <tr key={line.id || idx} className="py-1">
                      <td className="py-1 text-center font-mono text-[10px]">{idx + 1}</td>
                      <td className="py-1 font-medium">{line.descriptionSnapshot}</td>
                      <td className="py-1 text-center text-[10px] text-[#5C726C] print:text-black">
                        {line.sourceType === "SERVICE_CHARGE" ? "ค่าบริการ" : "ค่ายา"}
                      </td>
                      <td className="py-1 text-center font-mono">{line.quantity}</td>
                      <td className="py-1 text-right font-mono">{formatBaht(line.unitPriceSatang)}</td>
                      <td className="py-1 text-right font-mono font-semibold">{formatBaht(line.lineTotalSatang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Summary & Totals */}
            <div className="mt-4 border-t-2 border-[#17312F] pt-2">
              <div className="flex justify-between items-center bg-[#F4F8F6] p-2 rounded print:bg-transparent print:border print:border-black">
                <div className="text-xs">
                  <p className="font-bold text-[#0B6B67] print:text-black">
                    ( {satangToThaiBahtText(invoice.totalSatang)} )
                  </p>
                  <p className="text-[10px] text-[#5C726C] print:text-black mt-0.5">
                    วิธีชำระเงิน:{" "}
                    {paymentMethod === "PROMPTPAY"
                      ? `พร้อมเพย์ QR ${externalReference ? `(${externalReference})` : ""}`
                      : paymentMethod === "CREDIT_CARD"
                      ? `บัตรเครดิต/เดบิต (${externalReference || "-"})`
                      : paymentMethod === "EXTERNAL_REFERENCE"
                      ? `เงินโอน/อื่นๆ (${externalReference || "-"})`
                      : "เงินสด"}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-[#5C726C] print:text-black mr-2">ยอดรวมสุทธิ:</span>
                  <span className="text-base font-black text-[#0B6B67] print:text-black font-mono">
                    ฿{formatBaht(invoice.totalSatang)}
                  </span>
                </div>
              </div>
            </div>

            {/* Signatures */}
            <div className="mt-8 grid grid-cols-2 gap-4 text-center text-xs">
              <div>
                <p className="border-b border-dashed border-gray-400 pb-1 mb-1"></p>
                <p className="text-[11px] text-[#5C726C] print:text-black">ลายมือชื่อผู้รับบริการ / ญาติ</p>
              </div>
              <div>
                <p className="border-b border-dashed border-gray-400 pb-1 mb-1 font-semibold">{cashierName}</p>
                <p className="text-[11px] text-[#5C726C] print:text-black">ผู้รับเงิน / ออกใบเสร็จ</p>
              </div>
            </div>

            <div className="mt-6 text-center text-[9px] text-[#71837E] print:text-black">
              * เอกสารนี้พิมพ์จากระบบสารสนเทศคลินิก Mor-Paul HIS
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
