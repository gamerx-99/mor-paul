import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AccessDenied } from "@/pages/FrontDesk";
import { Banknote, CheckCircle2, CircleDollarSign, PackageCheck, Plus, ReceiptText, ShieldAlert } from "lucide-react";
import React, { FormEvent, useEffect, useMemo, useState } from "react";

const baht = (satang: number | null | undefined) => new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB" }).format((satang ?? 0) / 100);
const statusLabel = (status: string) => status === "DISPENSING" ? "รอจัดบิล" : status === "BILLED" ? "รอรับชำระ" : status === "CLOSED" ? "ปิดงานแล้ว" : "รอดำเนินการ";

export default function Cashier() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "EXTERNAL_REFERENCE">("CASH");
  const [externalReference, setExternalReference] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceDetail, setServiceDetail] = useState("");
  const [serviceQuantity, setServiceQuantity] = useState("1");
  const [serviceUnitPriceBaht, setServiceUnitPriceBaht] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canUseCashier = user?.role === "ASSISTANT";
  const visits = trpc.pharmacy.cashier.listVisits.useQuery(undefined, { enabled: canUseCashier });
  const details = trpc.pharmacy.cashier.getVisit.useQuery({ visitId: selectedVisitId ?? 0 }, { enabled: canUseCashier && selectedVisitId !== null });
  const invalidateCashier = async () => { await utils.pharmacy.cashier.listVisits.invalidate(); await utils.pharmacy.cashier.getVisit.invalidate(); };
  const dispense = trpc.pharmacy.cashier.dispense.useMutation({ onSuccess: async result => { setNotice(result.replayed ? "รายการจ่ายยานี้ได้รับการประมวลผลแล้ว" : "จ่ายยาแล้ว โปรดเพิ่มค่าบริการ (ถ้ามี) และออกใบเรียกเก็บก่อนรับชำระ"); await invalidateCashier(); } });
  const addServiceCharge = trpc.pharmacy.cashier.addServiceCharge.useMutation({ onSuccess: async () => { setServiceDescription(""); setServiceDetail(""); setServiceQuantity("1"); setServiceUnitPriceBaht(""); setNotice("เพิ่มค่าบริการแล้ว โปรดตรวจสอบรายการก่อนออกใบเรียกเก็บ"); await invalidateCashier(); } });
  const issueInvoice = trpc.pharmacy.cashier.issueInvoice.useMutation({ onSuccess: async result => { setNotice(result.replayed ? "ใบเรียกเก็บนี้ได้รับการออกแล้ว" : `ออกใบเรียกเก็บ ${result.invoiceNumber} แล้ว โปรดรับชำระเพื่อปิดงาน`); await invalidateCashier(); } });
  const receivePayment = trpc.pharmacy.cashier.receivePayment.useMutation({ onSuccess: async result => { setNotice(result.replayed ? "รายการรับชำระนี้ได้รับการประมวลผลแล้ว" : "รับชำระแล้ว และปิดงานเรียบร้อย"); setSelectedVisitId(null); await invalidateCashier(); } });

  useEffect(() => { if (visits.data?.length && selectedVisitId === null) setSelectedVisitId(visits.data[0].visitId); }, [visits.data, selectedVisitId]);
  const visit = details.data;
  const pendingServiceTotal = useMemo(() => (visit?.serviceCharges ?? []).filter(item => item.status === "PENDING").reduce((sum, item) => sum + item.quantity * item.unitPriceSatang, 0), [visit?.serviceCharges]);

  if (!canUseCashier) return <AccessDenied title="การเงินและการปิดงาน" detail="หน้านี้สงวนสิทธิ์สำหรับผู้ช่วยที่รับผิดชอบค่าบริการ จ่ายยา ออกบิล และรับชำระเท่านั้น" />;

  async function runDispense() {
    if (!selectedVisitId) return;
    setError(null); setNotice(null);
    try { await dispense.mutateAsync({ visitId: selectedVisitId, idempotencyKey: crypto.randomUUID() }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถจ่ายยาได้"); }
  }
  async function runAddService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVisitId) return;
    const quantity = Number(serviceQuantity);
    const unitPriceSatang = Math.round(Number(serviceUnitPriceBaht) * 100);
    if (!Number.isInteger(quantity) || quantity < 1 || !Number.isInteger(unitPriceSatang) || unitPriceSatang < 0) { setError("กรุณาระบุจำนวนเต็มอย่างน้อย 1 และราคาต่อหน่วยที่ถูกต้อง"); return; }
    setError(null); setNotice(null);
    try { await addServiceCharge.mutateAsync({ visitId: selectedVisitId, description: serviceDescription, detail: serviceDetail || undefined, quantity, unitPriceSatang }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถเพิ่มค่าบริการได้"); }
  }
  async function runIssueInvoice() {
    if (!selectedVisitId) return;
    setError(null); setNotice(null);
    try { await issueInvoice.mutateAsync({ visitId: selectedVisitId, idempotencyKey: crypto.randomUUID() }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถออกใบเรียกเก็บได้"); }
  }
  async function runPayment() {
    if (!visit?.invoiceId || visit.totalSatang === null) return;
    setError(null); setNotice(null);
    try { await receivePayment.mutateAsync({ invoiceId: visit.invoiceId, paymentMethod, amountSatang: visit.totalSatang, externalReference: paymentMethod === "EXTERNAL_REFERENCE" ? externalReference : undefined, idempotencyKey: crypto.randomUUID() }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถรับชำระได้"); }
  }

  return <div className="mx-auto max-w-[1500px] space-y-5 text-[#17312F]">
    <header className="rounded-[22px] border border-[#D5E3DD] bg-[#EAF4F0] px-5 py-5 sm:px-7"><p className="font-mono text-[11px] font-bold tracking-[0.14em] text-[#0B6B67]">ASSISTANT WORKSPACE / BILLING & PAYMENT</p><div className="mt-2 flex items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold">ค่าบริการ จ่ายยา และรับชำระ</h1><p className="mt-1 text-sm text-[#5C726C]">แยกค่าบริการออกจากค่ายา ออกใบเรียกเก็บ และรับชำระครบถ้วนก่อนระบบปิดงานทุกครั้ง</p></div><Banknote className="text-[#0B6B67]" size={28} /></div></header>
    {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-[#E7C9C1] bg-[#FFF3F0] text-[#A13C2F]" : "border-[#CBE1D8] bg-[#F2F8F5] text-[#276451]"}`}>{error || notice}</p>}
    <div className="grid gap-5 lg:grid-cols-[minmax(300px,0.42fr)_minmax(0,1fr)]">
      <section className="rounded-[20px] border border-[#DCE5DF] bg-white p-4"><h2 className="font-semibold">รายการรอดำเนินการ</h2><p className="mt-1 text-xs text-[#71837E]">เฉพาะ encounter ที่แพทย์ลงนามแล้วและยังไม่ปิดงาน</p><div className="mt-4 space-y-2">{visits.isLoading ? <p className="text-sm text-[#60756E]">กำลังโหลดรายการ…</p> : !visits.data?.length ? <p className="rounded-xl bg-[#F5F8F6] px-4 py-5 text-sm text-[#60756E]">ยังไม่มีรายการที่รอออกบิลหรือรับชำระ</p> : visits.data.map(item => <button key={item.visitId} onClick={() => setSelectedVisitId(item.visitId)} className={`w-full rounded-xl border p-3 text-left transition ${selectedVisitId === item.visitId ? "border-[#0B6B67] bg-[#F0F8F5]" : "border-[#E1E8E3] hover:bg-[#F8FBF9]"}`}><p className="font-mono text-xs font-bold text-[#0B6B67]">{item.hn}</p><p className="mt-1 font-semibold">{item.firstName} {item.lastName}</p><p className="mt-1 text-xs text-[#71837E]">{statusLabel(item.visitStatus)} · {item.invoiceNumber ?? "ยังไม่มีใบเรียกเก็บ"}</p></button>)}</div></section>
      <section className="rounded-[20px] border border-[#DCE5DF] bg-white p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">{details.isLoading ? <p className="text-sm text-[#60756E]">กำลังโหลดรายละเอียด…</p> : !visit ? <div className="grid min-h-80 place-items-center text-center"><div><ReceiptText className="mx-auto text-[#0B6B67]" size={28} /><h2 className="mt-3 font-semibold">เลือกรายการทางซ้าย</h2><p className="mt-1 text-sm text-[#60756E]">ระบบจะไม่แสดงข้อมูลตัวอย่าง</p></div></div> : <>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E1E8E3] pb-4"><div><p className="font-mono text-xs font-bold text-[#0B6B67]">{visit.hn}</p><h2 className="mt-1 text-xl font-semibold">{visit.firstName} {visit.lastName}</h2></div><span className="rounded-full bg-[#F0F8F5] px-3 py-1 text-xs font-semibold text-[#276451]">{statusLabel(visit.visitStatus)}</span></div>
        <section className="mt-5"><h3 className="font-semibold">ค่ายา</h3>{!visit.items.length ? <p className="mt-2 rounded-xl bg-[#F5F8F6] px-3 py-3 text-sm text-[#60756E]">ไม่มีคำสั่งยา แต่ encounter นี้ยังต้องผ่านการออกบิลและรับชำระก่อนปิดงาน</p> : <div className="mt-3 divide-y divide-[#EEF2EF] rounded-xl border border-[#E1E8E3] px-4">{visit.items.map(item => <div key={item.id} className="py-3"><p className="font-semibold">{item.medicationNameSnapshot} · {item.strengthSnapshot}</p><p className="mt-1 text-sm text-[#60756E]">{item.dose} · {item.frequency} · จำนวน {item.quantityPrescribed}{item.duration ? ` · ${item.duration}` : ""}</p>{item.instructions ? <p className="mt-1 text-xs text-[#71837E]">{item.instructions}</p> : null}</div>)}</div>}{visit.visitStatus === "DISPENSING" && visit.items.length > 0 && !visit.invoiceId ? <button onClick={() => void runDispense()} disabled={dispense.isPending} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl border border-[#17312F] bg-[#17312F] px-4 text-sm font-semibold text-white disabled:opacity-55"><PackageCheck size={16} />{dispense.isPending ? "กำลังจ่ายยา…" : "ยืนยันการจ่ายยา"}</button> : null}</section>
        {visit.visitStatus === "DISPENSING" ? <section className="mt-5 rounded-xl border border-[#D5E3DD] bg-[#F7FCFA] p-4"><div className="flex items-start gap-2"><Plus className="mt-0.5 text-[#0B6B67]" size={18} /><div><h3 className="font-semibold">ค่าบริการ</h3><p className="mt-0.5 text-xs leading-5 text-[#60756E]">กรอกชื่อบริการ จำนวน ราคาต่อหน่วย และรายละเอียดที่ต้องการให้แสดงบนใบเรียกเก็บ ระบบจะบันทึกเป็นรายการแยกจากยา</p></div></div><form onSubmit={runAddService} className="mt-4 grid gap-3 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[#526861]">ชื่อบริการ</span><input required value={serviceDescription} onChange={event => setServiceDescription(event.target.value)} className="h-10 w-full rounded-lg border border-[#BBD8CE] bg-white px-3 text-sm" placeholder="เช่น ค่าตรวจแพทย์" /></label><label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[#526861]">รายละเอียดบนใบเรียกเก็บ (ถ้ามี)</span><input value={serviceDetail} onChange={event => setServiceDetail(event.target.value)} className="h-10 w-full rounded-lg border border-[#BBD8CE] bg-white px-3 text-sm" placeholder="เช่น ตรวจติดตามอาการ" /></label><label><span className="mb-1 block text-xs font-semibold text-[#526861]">จำนวน</span><input required inputMode="numeric" value={serviceQuantity} onChange={event => setServiceQuantity(event.target.value)} className="h-10 w-full rounded-lg border border-[#BBD8CE] bg-white px-3 text-sm" /></label><label><span className="mb-1 block text-xs font-semibold text-[#526861]">ราคาต่อหน่วย (บาท)</span><input required inputMode="decimal" value={serviceUnitPriceBaht} onChange={event => setServiceUnitPriceBaht(event.target.value)} className="h-10 w-full rounded-lg border border-[#BBD8CE] bg-white px-3 text-sm" /></label><button disabled={addServiceCharge.isPending} className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-[#0B6B67] bg-white px-4 text-sm font-semibold text-[#0B6B67] disabled:opacity-55"><Plus size={16} />{addServiceCharge.isPending ? "กำลังเพิ่ม…" : "เพิ่มค่าบริการ"}</button></form>{visit.serviceCharges.length ? <div className="mt-4 divide-y divide-[#DCE5DF] rounded-xl border border-[#DCE5DF] bg-white px-3">{visit.serviceCharges.map(item => <div key={item.id} className="flex items-start justify-between gap-3 py-3"><div><p className="font-semibold">{item.description}</p>{item.detail ? <p className="mt-0.5 text-xs text-[#71837E]">{item.detail}</p> : null}<p className="mt-1 text-xs text-[#60756E]">จำนวน {item.quantity} × {baht(item.unitPriceSatang)} · {item.status === "PENDING" ? "รอออกบิล" : "อยู่ในใบเรียกเก็บ"}</p></div><p className="font-semibold">{baht(item.quantity * item.unitPriceSatang)}</p></div>)}</div> : null}</section> : null}
        {visit.visitStatus === "DISPENSING" ? <section className="mt-5 rounded-xl border border-[#F0D9C9] bg-[#FFF8F3] p-4"><div className="flex gap-2 text-sm text-[#8C462B]"><ShieldAlert className="shrink-0" size={18} /><p>{visit.items.length && !visit.invoiceId ? "โปรดยืนยันการจ่ายยาก่อนออกใบเรียกเก็บ จากนั้นตรวจค่าบริการและออกบิลเพื่อเข้าสู่ขั้นตอนรับชำระ" : `ตรวจสอบค่ายาและค่าบริการก่อนออกใบเรียกเก็บ${pendingServiceTotal ? ` (ค่าบริการที่ยังไม่ออกบิล ${baht(pendingServiceTotal)})` : ""} ทุก encounter ต้องรับชำระก่อนปิดงาน`}</p></div><button onClick={() => void runIssueInvoice()} disabled={issueInvoice.isPending || (visit.items.length > 0 && !visit.invoiceId)} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[#17312F] px-4 text-sm font-semibold text-white disabled:opacity-55"><ReceiptText size={16} />{issueInvoice.isPending ? "กำลังออกใบเรียกเก็บ…" : "ออกใบเรียกเก็บ"}</button></section> : <section className="mt-5 rounded-xl border border-[#CBE1D8] bg-[#F2F8F5] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{visit.invoiceNumber ?? "ใบเรียกเก็บ"}</p><p className="mt-1 text-sm text-[#276451]">ยอดรับชำระ {baht(visit.totalSatang)}</p></div><CircleDollarSign className="text-[#276451]" size={24} /></div>{visit.invoiceLines.length ? <div className="mt-4 divide-y divide-[#CBE1D8] rounded-xl border border-[#CBE1D8] bg-white px-3">{visit.invoiceLines.map(line => <div key={line.id} className="flex justify-between gap-3 py-2.5 text-sm"><div><p className="font-semibold">{line.descriptionSnapshot}</p><p className="text-xs text-[#60756E]">{line.sourceType === "SERVICE_CHARGE" ? "ค่าบริการ" : "ค่ายา"} · {line.quantity} × {baht(line.unitPriceSatang)}</p></div><p className="font-semibold">{baht(line.lineTotalSatang)}</p></div>)}</div> : <p className="mt-3 rounded-xl bg-white px-3 py-3 text-sm text-[#60756E]">ไม่มีรายการคิดเงิน ยอดรับชำระเป็นศูนย์บาท แต่ยังต้องบันทึกการรับชำระเพื่อปิดงาน</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-xs font-semibold text-[#526861]">วิธีรับชำระ</span><select value={paymentMethod} onChange={event => setPaymentMethod(event.target.value as "CASH" | "EXTERNAL_REFERENCE")} className="h-10 w-full rounded-lg border border-[#BBD8CE] bg-white px-3 text-sm"><option value="CASH">เงินสด</option><option value="EXTERNAL_REFERENCE">เลขอ้างอิงภายนอก</option></select></label>{paymentMethod === "EXTERNAL_REFERENCE" ? <label><span className="mb-1 block text-xs font-semibold text-[#526861]">เลขอ้างอิง</span><input value={externalReference} onChange={event => setExternalReference(event.target.value)} className="h-10 w-full rounded-lg border border-[#BBD8CE] px-3 text-sm" /></label> : null}</div><button onClick={() => void runPayment()} disabled={receivePayment.isPending || (paymentMethod === "EXTERNAL_REFERENCE" && !externalReference.trim()) || visit.invoiceStatus === "PAID"} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B6B67] px-4 text-sm font-semibold text-white disabled:opacity-55"><CheckCircle2 size={16} />{receivePayment.isPending ? "กำลังบันทึก…" : visit.invoiceStatus === "PAID" ? "ชำระแล้ว" : `รับชำระ ${baht(visit.totalSatang)}`}</button></section>}
      </>}</section>
    </div>
  </div>;
}
