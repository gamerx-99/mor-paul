import { generatePromptPayPayload } from "@shared/promptpay";
import { generateQrMatrix } from "@shared/qrcode";
import { Check, Copy, QrCode } from "lucide-react";
import { useMemo, useState } from "react";

interface PromptPayQrProps {
  /** 10-digit mobile number or 13-digit Tax ID/National ID */
  target: string;
  /** Amount in Satang (e.g. 15000 = 150.00 THB) */
  amountSatang: number;
  /** Clinic or Merchant Display Name */
  merchantName?: string;
  className?: string;
}

export default function PromptPayQr({
  target,
  amountSatang,
  merchantName = "คลินิกหมอพัลลภ",
  className = "",
}: PromptPayQrProps) {
  const [copied, setCopied] = useState(false);

  const payload = useMemo(() => {
    return generatePromptPayPayload({ target, amountSatang });
  }, [target, amountSatang]);

  const matrix = useMemo(() => {
    try {
      return generateQrMatrix(payload);
    } catch {
      return [];
    }
  }, [payload]);

  const bahtAmount = (amountSatang / 100).toLocaleString("th-TH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const handleCopyPayload = () => {
    navigator.clipboard.writeText(payload);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col items-center rounded-2xl border border-[#BBD8CE] bg-white p-5 shadow-sm text-center ${className}`}>
      {/* PromptPay Header Banner */}
      <div className="w-full rounded-xl bg-[#003B5C] py-2.5 px-4 text-white text-center shadow-sm">
        <p className="text-[10px] font-bold tracking-widest uppercase opacity-80">THAI QR PAYMENT</p>
        <p className="text-base font-bold tracking-wider">พร้อมเพย์ PromptPay</p>
      </div>

      <div className="mt-3">
        <p className="text-xs text-[#526861]">{merchantName}</p>
        <p className="text-xs font-mono font-bold text-[#17312F] mt-0.5">
          {target.length === 10
            ? `${target.slice(0, 3)}-${target.slice(3, 6)}-${target.slice(6)}`
            : target}
        </p>
      </div>

      {/* SVG QR Code */}
      <div className="mt-3 rounded-xl border border-[#D5E3DD] bg-white p-3 shadow-inner">
        {matrix.length > 0 ? (
          <svg
            viewBox={`0 0 ${matrix.length} ${matrix.length}`}
            className="h-48 w-48 shape-rendering-crisp"
            shapeRendering="crispEdges"
          >
            <rect width="100%" height="100%" fill="white" />
            {matrix.map((row, r) =>
              row.map((cell, c) =>
                cell ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#003B5C" /> : null
              )
            )}
          </svg>
        ) : (
          <div className="grid h-48 w-48 place-items-center text-xs text-red-600">
            ไม่สามารถสร้าง QR Code ได้
          </div>
        )}
      </div>

      {/* Amount Display */}
      <div className="mt-3 text-center">
        <p className="text-xs text-[#69807A]">จำนวนเงินที่ต้องชำระ</p>
        <p className="text-2xl font-extrabold text-[#003B5C]">฿{bahtAmount}</p>
      </div>

      <div className="mt-3 flex w-full gap-2">
        <button
          type="button"
          onClick={handleCopyPayload}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#D5E3DD] bg-[#F7FCFA] py-1.5 text-xs font-semibold text-[#0B6B67] hover:bg-[#EAF4F0]"
        >
          {copied ? <Check size={14} className="text-[#10B981]" /> : <Copy size={14} />}
          <span>{copied ? "คัดลอกรหัสแล้ว" : "คัดลอกรหัส QR"}</span>
        </button>
      </div>
    </div>
  );
}
