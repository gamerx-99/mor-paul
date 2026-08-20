import { useAuth } from "@/_core/hooks/useAuth";
import InvoiceReceiptPrint from "@/components/documents/InvoiceReceiptPrint";
import MedicationLabelPrint from "@/components/documents/MedicationLabelPrint";
import PromptPayQr from "@/components/PromptPayQr";
import { trpc } from "@/lib/trpc";
import { AccessDenied } from "@/pages/FrontDesk";
import {
  Banknote,
  CalendarCheck,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  PackageCheck,
  Percent,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  ShieldAlert,
} from "lucide-react";
import React, { FormEvent, useEffect, useMemo, useState } from "react";

const baht = (satang: number | null | undefined) =>
  new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format((satang ?? 0) / 100);

const statusLabel = (status: string) =>
  status === "DISPENSING"
    ? "รอจัดบิล"
    : status === "BILLED"
    ? "รอรับชำระ"
    : status === "CLOSED"
    ? "ปิดงานแล้ว"
    : "รอดำเนินการ";

export default function Cashier() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"billing" | "dailyCloseout">("billing");

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "PROMPTPAY" | "EXTERNAL_REFERENCE" | "CREDIT_CARD">("CASH");
  const [externalReference, setExternalReference] = useState("");
  const [cashTenderedBaht, setCashTenderedBaht] = useState("");

  // Discount states
  const [discountBaht, setDiscountBaht] = useState("");
  const [discountReason, setDiscountReason] = useState("");

  // Service charge states
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceDetail, setServiceDetail] = useState("");
  const [serviceQuantity, setServiceQuantity] = useState("1");
  const [serviceUnitPriceBaht, setServiceUnitPriceBaht] = useState("");

  // Daily closeout states
  const todayStr = new Date().toISOString().slice(0, 10);
  const [countedCashBaht, setCountedCashBaht] = useState("");
  const [closeoutNotes, setCloseoutNotes] = useState("");

  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showLabelPrint, setShowLabelPrint] = useState(false);
  const [showReceiptPrint, setShowReceiptPrint] = useState(false);

  const canUseCashier = user?.role === "ASSISTANT";
  const visits = trpc.pharmacy.cashier.listVisits.useQuery(undefined, { enabled: canUseCashier });
  const details = trpc.pharmacy.cashier.getVisit.useQuery(
    { visitId: selectedVisitId ?? 0 },
    { enabled: canUseCashier && selectedVisitId !== null }
  );
  const dailySummary = trpc.pharmacy.cashier.getDailySummary.useQuery(
    { date: todayStr },
    { enabled: canUseCashier && activeTab === "dailyCloseout" }
  );

  const invalidateCashier = async () => {
    await utils.pharmacy.cashier.listVisits.invalidate();
    await utils.pharmacy.cashier.getVisit.invalidate();
    await utils.pharmacy.cashier.getDailySummary.invalidate();
  };

  const dispense = trpc.pharmacy.cashier.dispense.useMutation({
    onSuccess: async result => {
      setNotice(result.replayed ? "รายการจ่ายยานี้ได้รับการประมวลผลแล้ว" : "จ่ายยาแล้ว โปรดเพิ่มค่าบริการ (ถ้ามี) และออกใบเรียกเก็บก่อนรับชำระ");
      await invalidateCashier();
    },
  });

  const addServiceCharge = trpc.pharmacy.cashier.addServiceCharge.useMutation({
    onSuccess: async () => {
      setServiceDescription("");
      setServiceDetail("");
      setServiceQuantity("1");
      setServiceUnitPriceBaht("");
      setNotice("เพิ่มค่าบริการแล้ว โปรดตรวจสอบรายการก่อนออกใบเรียกเก็บ");
      await invalidateCashier();
    },
  });

  const issueInvoice = trpc.pharmacy.cashier.issueInvoice.useMutation({
    onSuccess: async result => {
      setNotice(result.replayed ? "ใบเรียกเก็บนี้ได้รับการออกแล้ว" : `ออกใบเรียกเก็บ ${result.invoiceNumber} แล้ว โปรดรับชำระเพื่อปิดงาน`);
      await invalidateCashier();
    },
  });

  const receivePayment = trpc.pharmacy.cashier.receivePayment.useMutation({
    onSuccess: async result => {
      setNotice(result.replayed ? "รายการรับชำระนี้ได้รับการประมวลผลแล้ว" : "รับชำระแล้ว และปิดงานเรียบร้อย");
      setSelectedVisitId(null);
      setCashTenderedBaht("");
      setExternalReference("");
      await invalidateCashier();
    },
  });

  const submitCloseout = trpc.pharmacy.cashier.submitDailyCloseout.useMutation({
    onSuccess: async () => {
      setNotice("บันทึกการปิดยอดเงินสดประจำวันเรียบร้อยแล้ว");
      setCountedCashBaht("");
      setCloseoutNotes("");
      await invalidateCashier();
    },
  });

  useEffect(() => {
    if (visits.data?.length && selectedVisitId === null) {
      setSelectedVisitId(visits.data[0].visitId);
    }
  }, [visits.data, selectedVisitId]);

  const visit = details.data;
  const pendingServiceTotal = useMemo(
    () => (visit?.serviceCharges ?? []).filter(item => item.status === "PENDING").reduce((sum, item) => sum + item.quantity * item.unitPriceSatang, 0),
    [visit?.serviceCharges]
  );

  const discountSatang = Math.round(Number(discountBaht || 0) * 100);

  // Cash change calculation
  const totalDueSatang = visit?.totalSatang ?? 0;
  const cashTenderedSatang = Math.round(Number(cashTenderedBaht || 0) * 100);
  const changeSatang = Math.max(0, cashTenderedSatang - totalDueSatang);

  if (!canUseCashier) return <AccessDenied title="การเงินและการปิดงาน" detail="หน้านี้สงวนสิทธิ์สำหรับผู้ช่วยที่รับผิดชอบค่าบริการ จ่ายยา ออกบิล และรับชำระเท่านั้น" />;

  async function runDispense() {
    if (!selectedVisitId) return;
    setError(null);
    setNotice(null);
    try {
      await dispense.mutateAsync({ visitId: selectedVisitId, idempotencyKey: crypto.randomUUID() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถจ่ายยาได้");
    }
  }

  async function runAddService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVisitId) return;
    const quantity = Number(serviceQuantity);
    const unitPriceSatang = Math.round(Number(serviceUnitPriceBaht) * 100);
    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(unitPriceSatang) || unitPriceSatang < 0) {
      setError("กรุณาระบุจำนวนเต็มอย่างน้อย 1 และราคาต่อหน่วยที่ถูกต้อง");
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await addServiceCharge.mutateAsync({ visitId: selectedVisitId, description: serviceDescription, detail: serviceDetail || undefined, quantity, unitPriceSatang });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถเพิ่มค่าบริการได้");
    }
  }

  async function runIssueInvoice() {
    if (!selectedVisitId) return;
    setError(null);
    setNotice(null);
    try {
      await issueInvoice.mutateAsync({
        visitId: selectedVisitId,
        idempotencyKey: crypto.randomUUID(),
        discountSatang: discountSatang > 0 ? discountSatang : undefined,
        discountReason: discountReason.trim() || undefined,
      });
      setDiscountBaht("");
      setDiscountReason("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถออกใบเรียกเก็บได้");
    }
  }

  async function runPayment() {
    if (!visit?.invoiceId || visit.totalSatang === null) return;
    setError(null);
    setNotice(null);
    try {
      await receivePayment.mutateAsync({
        invoiceId: visit.invoiceId,
        paymentMethod,
        amountSatang: visit.totalSatang,
        externalReference: (paymentMethod === "EXTERNAL_REFERENCE" || paymentMethod === "CREDIT_CARD" || paymentMethod === "PROMPTPAY") ? externalReference : undefined,
        idempotencyKey: crypto.randomUUID(),
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถรับชำระได้");
    }
  }

  async function runSubmitCloseout(e: FormEvent) {
    e.preventDefault();
    const countedSatang = Math.round(Number(countedCashBaht || 0) * 100);
    setError(null);
    setNotice(null);
    try {
      await submitCloseout.mutateAsync({
        closeoutDate: todayStr,
        totalCashCountedSatang: countedSatang,
        notes: closeoutNotes.trim() || undefined,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกการปิดยอดประจำวันได้");
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 text-[#17312F]">
      <header className="rounded-[22px] border border-[#D5E3DD] bg-[#EAF4F0] px-5 py-5 sm:px-7">
        <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-[#0B6B67]">
          ASSISTANT WORKSPACE / BILLING & PAYMENT
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">ค่าบริการ จ่ายยา และรับชำระ</h1>
            <p className="mt-1 text-sm text-[#5C726C]">
              แยกค่าบริการออกจากค่ายา ให้ส่วนลด รับชำระเงินสด/PromptPay และตรวจนับปิดยอดประจำวัน
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("billing")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === "billing" ? "bg-[#0B6B67] text-white shadow-sm" : "bg-white text-[#0B6B67] hover:bg-[#F0F8F5]"
              }`}
            >
              <Banknote size={15} /> หน้าจอจัดบิล
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("dailyCloseout")}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === "dailyCloseout" ? "bg-[#0B6B67] text-white shadow-sm" : "bg-white text-[#0B6B67] hover:bg-[#F0F8F5]"
              }`}
            >
              <CalendarCheck size={15} /> ตรวจนับและปิดยอดประจำวัน
            </button>
          </div>
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

      {activeTab === "dailyCloseout" ? (
        /* Daily Cash Reconciliation & Shift Closeout Panel */
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Summary Box */}
          <section className="rounded-[20px] border border-[#DCE5DF] bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-[#EAF0EC] pb-4">
              <div className="flex items-center gap-2">
                <CalendarCheck className="text-[#0B6B67]" size={22} />
                <div>
                  <h2 className="font-bold text-lg">สรุปยอดประจำวันที่ {todayStr}</h2>
                  <p className="text-xs text-[#71837E]">ข้อมูลรายรับจริงที่บันทึกผ่านระบบในวันนี้</p>
                </div>
              </div>
              {dailySummary.data?.closeout && (
                <span className="rounded-full bg-[#EAF4F0] px-3 py-1 text-xs font-bold text-[#0B6B67]">
                  ปิดยอดแล้วเมื่อ {new Date(dailySummary.data.closeout.closedAt).toLocaleTimeString("th-TH")}
                </span>
              )}
            </div>

            {dailySummary.isLoading ? (
              <p className="py-8 text-center text-sm text-[#71837E]">กำลังโหลดข้อมูลสรุปประจำวัน…</p>
            ) : dailySummary.data ? (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-[#D5E3DD] bg-[#F7FCFA] p-4">
                    <p className="text-xs font-semibold text-[#526861]">💵 เงินสดในระบบ (Expected Cash)</p>
                    <p className="mt-1 text-xl font-bold text-[#17312F]">
                      {baht(dailySummary.data.totalCashExpectedSatang)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#BBD8CE] bg-[#F0F8F5] p-4">
                    <p className="text-xs font-semibold text-[#0B6B67]">📱 พร้อมเพย์ (PromptPay)</p>
                    <p className="mt-1 text-xl font-bold text-[#0B6B67]">
                      {baht(dailySummary.data.totalPromptPaySatang)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#DCE5DF] bg-[#FAFCFA] p-4">
                    <p className="text-xs font-semibold text-[#526861]">💳 บัตร/โอนอื่นๆ (Other)</p>
                    <p className="mt-1 text-xl font-bold text-[#17312F]">
                      {baht(dailySummary.data.totalOtherSatang)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#17312F] bg-[#17312F] p-4 text-white">
                    <p className="text-xs font-semibold text-[#A9CBC3]">💰 ยอดรวมทั้งสิ้น (Total Sales)</p>
                    <p className="mt-1 text-xl font-bold">
                      {baht(dailySummary.data.totalRevenueSatang)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-[#F7FCFA] p-3.5 text-xs text-[#526861]">
                  <span>จำนวนบิลที่รับชำระแล้ว: <strong>{dailySummary.data.paidInvoicesCount} ใบ</strong></span>
                  <span>ใบแจ้งหนี้ค้างชำระ: <strong className="text-[#A44B3B]">{dailySummary.data.unpaidInvoicesCount} ใบ ({baht(dailySummary.data.unpaidInvoicesSatang)})</strong></span>
                </div>
              </div>
            ) : null}
          </section>

          {/* Reconciliation Form */}
          <section className="rounded-[20px] border border-[#DCE5DF] bg-white p-6 shadow-sm">
            <h2 className="font-bold text-lg mb-1">ตรวจนับเงินสดในลิ้นชัก (Cash Count)</h2>
            <p className="text-xs text-[#71837E] mb-5">
              นับเงินสดจริงในลิ้นชักเพื่อเปรียบเทียบกับยอดเงินสดที่ระบบคาดหวัง
            </p>

            <form onSubmit={runSubmitCloseout} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#526861] mb-1">
                  ยอดเงินสดที่นับได้จริง (บาท) *
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={countedCashBaht}
                  onChange={e => setCountedCashBaht(e.target.value)}
                  placeholder="0.00"
                  className="h-11 w-full rounded-xl border border-[#BBD8CE] px-3.5 text-lg font-bold text-[#17312F] outline-none focus:border-[#0B6B67]"
                />
              </div>

              {countedCashBaht && dailySummary.data && (
                <div className="rounded-xl border p-4 text-sm space-y-1">
                  {(() => {
                    const countedSatang = Math.round(Number(countedCashBaht) * 100);
                    const diff = countedSatang - dailySummary.data.totalCashExpectedSatang;
                    if (diff === 0) {
                      return (
                        <div className="flex items-center gap-2 font-bold text-[#10B981]">
                          <CheckCircle2 size={18} />
                          <span>ยอดเงินสดตรงตามระบบ (พอดี)</span>
                        </div>
                      );
                    } else if (diff < 0) {
                      return (
                        <div className="flex items-center gap-2 font-bold text-[#EF4444]">
                          <ShieldAlert size={18} />
                          <span>ยอดเงินสดขาด: {baht(Math.abs(diff))}</span>
                        </div>
                      );
                    } else {
                      return (
                        <div className="flex items-center gap-2 font-bold text-[#3B82F6]">
                          <CircleDollarSign size={18} />
                          <span>ยอดเงินสดเกิน: {baht(diff)}</span>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#526861] mb-1">
                  หมายเหตุ / บันทึกการปิดยอด (ถ้ามี)
                </label>
                <textarea
                  rows={3}
                  value={closeoutNotes}
                  onChange={e => setCloseoutNotes(e.target.value)}
                  placeholder="เช่น ตรวจนับเงินทอนรอบเช้าครบถ้วน"
                  className="w-full rounded-xl border border-[#BBD8CE] p-3 text-xs outline-none focus:border-[#0B6B67]"
                />
              </div>

              <button
                type="submit"
                disabled={submitCloseout.isPending || !countedCashBaht}
                className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-[#0B6B67] text-white font-bold text-sm transition hover:bg-[#095956] disabled:opacity-50"
              >
                <CalendarCheck size={16} />
                {submitCloseout.isPending ? "กำลังบันทึก…" : "ยืนยันปิดยอดเงินสดประจำวัน"}
              </button>
            </form>
          </section>
        </div>
      ) : (
        /* Regular Billing & Payment Workflow */
        <div className="grid gap-5 lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)]">
          <section className="rounded-[20px] border border-[#DCE5DF] bg-white p-4">
            <h2 className="font-semibold">รายการรอดำเนินการ</h2>
            <p className="mt-1 text-xs text-[#71837E]">เฉพาะ encounter ที่แพทย์ลงนามแล้วและยังไม่ปิดงาน</p>
            <div className="mt-4 space-y-2">
              {visits.isLoading ? (
                <p className="text-sm text-[#60756E]">กำลังโหลดรายการ…</p>
              ) : !visits.data?.length ? (
                <p className="rounded-xl bg-[#F5F8F6] px-4 py-5 text-sm text-[#60756E]">ยังไม่มีรายการที่รอออกบิลหรือรับชำระ</p>
              ) : (
                visits.data.map(item => (
                  <button
                    key={item.visitId}
                    onClick={() => setSelectedVisitId(item.visitId)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      selectedVisitId === item.visitId ? "border-[#0B6B67] bg-[#F0F8F5]" : "border-[#E1E8E3] hover:bg-[#F8FBF9]"
                    }`}
                  >
                    <p className="font-mono text-xs font-bold text-[#0B6B67]">{item.hn}</p>
                    <p className="mt-1 font-semibold">{item.firstName} {item.lastName}</p>
                    <p className="mt-1 text-xs text-[#71837E]">{statusLabel(item.visitStatus)} · {item.invoiceNumber ?? "ยังไม่มีใบเรียกเก็บ"}</p>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[20px] border border-[#DCE5DF] bg-white p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
            {details.isLoading ? (
              <p className="text-sm text-[#60756E]">กำลังโหลดรายละเอียด…</p>
            ) : !visit ? (
              <div className="grid min-h-80 place-items-center text-center">
                <div>
                  <ReceiptText className="mx-auto text-[#0B6B67]" size={28} />
                  <h2 className="mt-3 font-semibold">เลือกรายการทางซ้าย</h2>
                  <p className="mt-1 text-sm text-[#60756E]">ระบบจะไม่แสดงข้อมูลตัวอย่าง</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E1E8E3] pb-4">
                  <div>
                    <p className="font-mono text-xs font-bold text-[#0B6B67]">{visit.hn}</p>
                    <h2 className="mt-1 text-xl font-semibold">{visit.firstName} {visit.lastName}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {visit.items.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowLabelPrint(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#0B6B67] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B6B67] transition hover:bg-[#F0F8F5]"
                      >
                        <Printer size={14} /> พิมพ์ฉลากยา (A4)
                      </button>
                    )}
                    {visit.invoiceNumber && (
                      <button
                        type="button"
                        onClick={() => setShowReceiptPrint(true)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#17312F] bg-white px-3 py-1.5 text-xs font-semibold text-[#17312F] transition hover:bg-[#F7F5EF]"
                      >
                        <Printer size={14} /> พิมพ์ใบเสร็จ (A5)
                      </button>
                    )}
                    <span className="rounded-full bg-[#F0F8F5] px-3 py-1 text-xs font-semibold text-[#276451]">
                      {statusLabel(visit.visitStatus)}
                    </span>
                  </div>
                </div>

                {/* Medication Charges */}
                <section className="mt-5">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">ค่ายา</h3>
                    {visit.items.length > 0 && (
                      <button type="button" onClick={() => setShowLabelPrint(true)} className="inline-flex items-center gap-1 text-xs font-bold text-[#0B6B67] hover:underline">
                        <Printer size={13} /> พิมพ์ฉลากยาสติกเกอร์
                      </button>
                    )}
                  </div>
                  {!visit.items.length ? (
                    <p className="mt-2 rounded-xl bg-[#F5F8F6] px-3 py-3 text-sm text-[#60756E]">
                      ไม่มีคำสั่งยา แต่ encounter นี้ยังต้องผ่านการออกบิลและรับชำระก่อนปิดงาน
                    </p>
                  ) : (
                    <div className="mt-3 divide-y divide-[#EEF2EF] rounded-xl border border-[#E1E8E3] px-4">
                      {visit.items.map(item => (
                        <div key={item.id} className="py-3">
                          <p className="font-semibold">{item.medicationNameSnapshot} · {item.strengthSnapshot}</p>
                          <p className="mt-1 text-sm text-[#60756E]">
                            {item.dose} · {item.frequency} · จำนวน {item.quantityPrescribed}{item.duration ? ` · ${item.duration}` : ""}
                          </p>
                          {item.instructions ? <p className="mt-1 text-xs text-[#71837E]">{item.instructions}</p> : null}
                        </div>
                      ))}
                    </div>
                  )}
                  {visit.visitStatus === "DISPENSING" && visit.items.length > 0 && !visit.invoiceId ? (
                    <button
                      onClick={() => void runDispense()}
                      disabled={dispense.isPending}
                      className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[#17312F] bg-[#17312F] px-4 text-sm font-semibold text-white disabled:opacity-55"
                    >
                      <PackageCheck size={16} />
                      {dispense.isPending ? "กำลังจ่ายยา…" : "ยืนยันการจ่ายยา"}
                    </button>
                  ) : null}
                </section>

                {/* Service Charges Entry */}
                {visit.visitStatus === "DISPENSING" ? (
                  <section className="mt-5 rounded-xl border border-[#D5E3DD] bg-[#F7FCFA] p-4">
                    <div className="flex items-start gap-2">
                      <Plus className="mt-0.5 text-[#0B6B67]" size={18} />
                      <div>
                        <h3 className="font-semibold">ค่าบริการ</h3>
                        <p className="mt-0.5 text-xs leading-5 text-[#60756E]">
                          กรอกชื่อบริการ จำนวน ราคาต่อหน่วย และรายละเอียดที่ต้องการให้แสดงบนใบเรียกเก็บ
                        </p>
                      </div>
                    </div>
                    <form onSubmit={runAddService} className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="sm:col-span-2">
                        <span className="mb-1 block text-xs font-semibold text-[#526861]">ชื่อบริการ</span>
                        <input required value={serviceDescription} onChange={event => setServiceDescription(event.target.value)} className="h-10 w-full rounded-lg border border-[#BBD8CE] bg-white px-3 text-sm" placeholder="เช่น ค่าตรวจแพทย์" />
                      </label>
                      <label className="sm:col-span-2">
                        <span className="mb-1 block text-xs font-semibold text-[#526861]">รายละเอียดบนใบเรียกเก็บ (ถ้ามี)</span>
                        <input value={serviceDetail} onChange={event => setServiceDetail(event.target.value)} className="h-10 w-full rounded-lg border border-[#BBD8CE] bg-white px-3 text-sm" placeholder="เช่น ตรวจติดตามอาการ" />
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-semibold text-[#526861]">จำนวน</span>
                        <input required inputMode="numeric" value={serviceQuantity} onChange={event => setServiceQuantity(event.target.value)} className="h-10 w-full rounded-lg border border-[#BBD8CE] bg-white px-3 text-sm" />
                      </label>
                      <label>
                        <span className="mb-1 block text-xs font-semibold text-[#526861]">ราคาต่อหน่วย (บาท)</span>
                        <input required inputMode="decimal" value={serviceUnitPriceBaht} onChange={event => setServiceUnitPriceBaht(event.target.value)} className="h-10 w-full rounded-lg border border-[#BBD8CE] bg-white px-3 text-sm" />
                      </label>
                      <button disabled={addServiceCharge.isPending} className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-[#0B6B67] bg-white px-4 text-sm font-semibold text-[#0B6B67] disabled:opacity-55">
                        <Plus size={16} />
                        {addServiceCharge.isPending ? "กำลังเพิ่ม…" : "เพิ่มค่าบริการ"}
                      </button>
                    </form>
                    {visit.serviceCharges.length ? (
                      <div className="mt-4 divide-y divide-[#DCE5DF] rounded-xl border border-[#DCE5DF] bg-white px-3">
                        {visit.serviceCharges.map(item => (
                          <div key={item.id} className="flex items-start justify-between gap-3 py-3">
                            <div>
                              <p className="font-semibold">{item.description}</p>
                              {item.detail ? <p className="mt-0.5 text-xs text-[#71837E]">{item.detail}</p> : null}
                              <p className="mt-1 text-xs text-[#60756E]">
                                จำนวน {item.quantity} × {baht(item.unitPriceSatang)} · {item.status === "PENDING" ? "รอออกบิล" : "อยู่ในใบเรียกเก็บ"}
                              </p>
                            </div>
                            <p className="font-semibold">{baht(item.quantity * item.unitPriceSatang)}</p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {/* Issuing Invoice or Payment */}
                {visit.visitStatus === "DISPENSING" ? (
                  <section className="mt-5 rounded-xl border border-[#F0D9C9] bg-[#FFF8F3] p-5">
                    <div className="flex gap-2 text-sm text-[#8C462B]">
                      <ShieldAlert className="shrink-0" size={18} />
                      <p>
                        {visit.items.length && !visit.invoiceId
                          ? "โปรดยืนยันการจ่ายยาก่อนออกใบเรียกเก็บ จากนั้นตรวจค่าบริการและออกบิลเพื่อเข้าสู่ขั้นตอนรับชำระ"
                          : `ตรวจสอบค่ายาและค่าบริการก่อนออกใบเรียกเก็บ${pendingServiceTotal ? ` (ค่าบริการที่ยังไม่ออกบิล ${baht(pendingServiceTotal)})` : ""} ทุก encounter ต้องรับชำระก่อนปิดงาน`}
                      </p>
                    </div>

                    {/* Discount Input Section */}
                    <div className="mt-4 rounded-xl border border-[#E7D6C9] bg-white p-4">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#8C462B] mb-3">
                        <Percent size={15} />
                        <span>ส่วนลดบนใบแจ้งหนี้ (Discount) — ถ้ามี</span>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                          <label className="block text-xs font-semibold text-[#526861] mb-1">
                            จำนวนเงินส่วนลด (บาท)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={discountBaht}
                            onChange={e => setDiscountBaht(e.target.value)}
                            placeholder="0.00"
                            className="h-10 w-full rounded-lg border border-[#BBD8CE] px-3 text-sm outline-none focus:border-[#0B6B67]"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-[#526861] mb-1">
                            เหตุผลส่วนลด
                          </label>
                          <input
                            value={discountReason}
                            onChange={e => setDiscountReason(e.target.value)}
                            placeholder="เช่น ส่วนลดผู้สูงอายุ, โปรโมชั่น, ส่วนลดพิเศษ"
                            className="h-10 w-full rounded-lg border border-[#BBD8CE] px-3 text-sm outline-none focus:border-[#0B6B67]"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => void runIssueInvoice()}
                      disabled={issueInvoice.isPending || (visit.items.length > 0 && !visit.invoiceId)}
                      className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[#17312F] px-5 text-sm font-semibold text-white disabled:opacity-55"
                    >
                      <ReceiptText size={16} />
                      {issueInvoice.isPending ? "กำลังออกใบเรียกเก็บ…" : "ออกใบเรียกเก็บ"}
                    </button>
                  </section>
                ) : (
                  <section className="mt-5 rounded-xl border border-[#CBE1D8] bg-[#F2F8F5] p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D5E3DD] pb-4">
                      <div>
                        <p className="font-semibold text-lg">{visit.invoiceNumber ?? "ใบเรียกเก็บ"}</p>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <p className="text-xl font-bold text-[#276451]">
                            ยอดรับชำระ {baht(visit.totalSatang)}
                          </p>
                          {visit.discountSatang ? (
                            <span className="text-xs text-[#8C462B] line-through">
                              (เดิม {baht(visit.subtotalSatang)})
                            </span>
                          ) : null}
                        </div>
                        {visit.discountSatang ? (
                          <p className="text-xs text-[#8C462B] mt-0.5">
                            หักส่วนลด {baht(visit.discountSatang)} {visit.discountReason ? `(${visit.discountReason})` : ""}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowReceiptPrint(true)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#0B6B67] bg-white px-3.5 py-2 text-xs font-semibold text-[#0B6B67] hover:bg-[#EAF4F0]"
                        >
                          <Printer size={14} /> พิมพ์ใบเสร็จ A5
                        </button>
                      </div>
                    </div>

                    {/* Invoice Lines Table */}
                    {visit.invoiceLines.length ? (
                      <div className="mt-4 divide-y divide-[#D5E3DD] rounded-xl border border-[#D5E3DD] bg-white px-4">
                        {visit.invoiceLines.map(line => (
                          <div key={line.id} className="flex justify-between gap-3 py-3 text-sm">
                            <div>
                              <p className="font-semibold">{line.descriptionSnapshot}</p>
                              <p className="text-xs text-[#60756E]">
                                {line.sourceType === "SERVICE_CHARGE" ? "ค่าบริการ" : "ค่ายา"} · {line.quantity} × {baht(line.unitPriceSatang)}
                              </p>
                            </div>
                            <p className="font-semibold">{baht(line.lineTotalSatang)}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-xl bg-white px-3 py-3 text-sm text-[#60756E]">
                        ไม่มีรายการคิดเงิน ยอดรับชำระเป็นศูนย์บาท แต่ยังต้องบันทึกการรับชำระเพื่อปิดงาน
                      </p>
                    )}

                    {/* Payment Method Selector & Interactive Form */}
                    <div className="mt-5 space-y-4">
                      <div>
                        <span className="block text-xs font-semibold text-[#526861] mb-2">เลือกวิธีรับชำระ</span>
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("CASH")}
                            className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition ${
                              paymentMethod === "CASH" ? "border-[#0B6B67] bg-white text-[#0B6B67] shadow-sm" : "border-[#D5E3DD] bg-[#F7FCFA] text-[#60756E]"
                            }`}
                          >
                            <Banknote size={18} />
                            <span>💵 เงินสด</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("PROMPTPAY")}
                            className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition ${
                              paymentMethod === "PROMPTPAY" ? "border-[#003B5C] bg-white text-[#003B5C] shadow-sm" : "border-[#D5E3DD] bg-[#F7FCFA] text-[#60756E]"
                            }`}
                          >
                            <QrCode size={18} />
                            <span>📱 พร้อมเพย์ QR</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentMethod("EXTERNAL_REFERENCE")}
                            className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-bold transition ${
                              paymentMethod === "EXTERNAL_REFERENCE" ? "border-[#17312F] bg-white text-[#17312F] shadow-sm" : "border-[#D5E3DD] bg-[#F7FCFA] text-[#60756E]"
                            }`}
                          >
                            <CreditCard size={18} />
                            <span>💳 โอน/อื่นๆ</span>
                          </button>
                        </div>
                      </div>

                      {/* Cash Payment with Tendered & Change Calculator */}
                      {paymentMethod === "CASH" && (
                        <div className="rounded-xl border border-[#BBD8CE] bg-white p-4 space-y-3">
                          <div>
                            <label className="block text-xs font-semibold text-[#526861] mb-1">
                              รับเงินสดมา (บาท)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={cashTenderedBaht}
                              onChange={e => setCashTenderedBaht(e.target.value)}
                              placeholder={`เช่น ${(totalDueSatang / 100).toFixed(0)}`}
                              className="h-10 w-full rounded-lg border border-[#BBD8CE] px-3 text-sm outline-none focus:border-[#0B6B67]"
                            />
                          </div>

                          {/* Quick Tendered Buttons */}
                          <div className="flex flex-wrap gap-1.5">
                            {[
                              { label: "พอดี", val: (totalDueSatang / 100).toFixed(0) },
                              { label: "100", val: "100" },
                              { label: "500", val: "500" },
                              { label: "1,000", val: "1000" },
                            ]
                              .filter(b => Number(b.val) >= totalDueSatang / 100 || b.label === "พอดี")
                              .map(b => (
                                <button
                                  key={b.label}
                                  type="button"
                                  onClick={() => setCashTenderedBaht(b.val)}
                                  className="rounded-lg bg-[#F0F8F5] px-2.5 py-1 text-xs font-semibold text-[#0B6B67] hover:bg-[#DDF0EA]"
                                >
                                  {b.label}
                                </button>
                              ))}
                          </div>

                          {cashTenderedSatang >= totalDueSatang && (
                            <div className="flex items-center justify-between rounded-lg bg-[#F7FCFA] p-3 text-sm">
                              <span className="font-semibold text-[#526861]">เงินทอน:</span>
                              <span className="text-lg font-bold text-[#10B981]">{baht(changeSatang)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* PromptPay QR Code Display */}
                      {paymentMethod === "PROMPTPAY" && (
                        <div className="space-y-3">
                          <PromptPayQr
                            target="0812345678"
                            amountSatang={visit.totalSatang ?? 0}
                            merchantName="คลินิกหมอพัลลภ"
                          />
                          <div>
                            <label className="block text-xs font-semibold text-[#526861] mb-1">
                              เลขอ้างอิงสลิปโอนเงิน (ถ้ามี)
                            </label>
                            <input
                              value={externalReference}
                              onChange={e => setExternalReference(e.target.value)}
                              placeholder="เช่น 20260821xxxx"
                              className="h-10 w-full rounded-lg border border-[#BBD8CE] px-3 text-sm outline-none focus:border-[#0B6B67]"
                            />
                          </div>
                        </div>
                      )}

                      {/* External Reference Input */}
                      {paymentMethod === "EXTERNAL_REFERENCE" && (
                        <div>
                          <label className="block text-xs font-semibold text-[#526861] mb-1">
                            เลขอ้างอิง / หลักฐานการโอน *
                          </label>
                          <input
                            required
                            value={externalReference}
                            onChange={e => setExternalReference(e.target.value)}
                            placeholder="เช่น เลขอ้างอิงสลิปธนาคาร หรือเลขอ้างอิงบัตร"
                            className="h-10 w-full rounded-lg border border-[#BBD8CE] px-3 text-sm outline-none focus:border-[#0B6B67]"
                          />
                        </div>
                      )}

                      <button
                        onClick={() => void runPayment()}
                        disabled={
                          receivePayment.isPending ||
                          (paymentMethod === "EXTERNAL_REFERENCE" && !externalReference.trim()) ||
                          visit.invoiceStatus === "PAID"
                        }
                        className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0B6B67] px-4 text-base font-bold text-white transition hover:bg-[#095956] disabled:opacity-55"
                      >
                        <CheckCircle2 size={18} />
                        {receivePayment.isPending
                          ? "กำลังบันทึก…"
                          : visit.invoiceStatus === "PAID"
                          ? "ชำระแล้ว"
                          : `รับชำระ ${baht(visit.totalSatang)}`}
                      </button>
                    </div>
                  </section>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {/* Print Modals */}
      {showLabelPrint && visit && (
        <MedicationLabelPrint
          patient={{ hn: visit.hn, firstName: visit.firstName, lastName: visit.lastName }}
          items={visit.items}
          onClose={() => setShowLabelPrint(false)}
        />
      )}

      {showReceiptPrint && visit && visit.invoiceNumber && (
        <InvoiceReceiptPrint
          invoice={{
            invoiceNumber: visit.invoiceNumber,
            totalSatang: visit.totalSatang ?? 0,
            issuedAt: new Date(),
            status: visit.invoiceStatus || "ISSUED",
          }}
          patient={{ hn: visit.hn, firstName: visit.firstName, lastName: visit.lastName }}
          lines={visit.invoiceLines}
          paymentMethod={paymentMethod}
          externalReference={externalReference}
          cashierName={user?.displayName || "เจ้าหน้าที่การเงิน"}
          onClose={() => setShowReceiptPrint(false)}
        />
      )}
    </div>
  );
}
