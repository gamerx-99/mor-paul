import { useAuth } from "@/_core/hooks/useAuth";
import { AccessDenied } from "@/pages/FrontDesk";
import { trpc } from "@/lib/trpc";
import { Activity, BellRing, ClipboardCheck, Clock3, RefreshCw, Stethoscope, UsersRound } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useLocation } from "wouter";

type QueueItem = {
  queueId: number;
  queueNumber: number;
  queueStatus: "WAITING" | "CALLED" | "IN_CONSULT" | "COMPLETED" | "CANCELLED";
  queueDate: string;
  assignedTo: number | null;
  calledAt: Date | null;
  completedAt: Date | null;
  visitId: number;
  visitStatus: string;
  chiefComplaint: string;
  patientId: number;
  hn: string;
  firstName: string;
  lastName: string;
  triageUrgency: "ROUTINE" | "PRIORITY" | "URGENT" | null;
  triagePerformedAt: Date | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  pulse: number | null;
  temperatureCelsius: string | null;
  oxygenSaturation: number | null;
  weightKg: string | null;
  heightCm: string | null;
  triageNote: string | null;
};

type Urgency = "ROUTINE" | "PRIORITY" | "URGENT";
const urgencyLabel: Record<Urgency, string> = { ROUTINE: "ปกติ", PRIORITY: "เร่งด่วน", URGENT: "ต้องพบแพทย์โดยเร็ว" };
const queueLabel: Record<QueueItem["queueStatus"], string> = { WAITING: "รอเรียก", CALLED: "เรียกแล้ว", IN_CONSULT: "กำลังตรวจ", COMPLETED: "เสร็จสิ้น", CANCELLED: "ยกเลิก" };

function todayInBrowser() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatTime(value: Date | null) {
  return value ? new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) : "-";
}

function optionalInteger(value: string) {
  return value.trim() === "" ? null : Number(value);
}

export default function QueueBoard() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [queueDate, setQueueDate] = useState(todayInBrowser);
  const [selectedVisitId, setSelectedVisitId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canReadQueue = user?.role === "ASSISTANT" || user?.role === "DOCTOR";
  const queryInput = useMemo(() => ({ queueDate }), [queueDate]);
  const queue = trpc.frontDesk.listQueue.useQuery(queryInput, { enabled: canReadQueue });
  const callNext = trpc.frontDesk.callNext.useMutation({
    onSuccess: result => {
      setNotice(result ? `เรียกคิว ${result.queueNumber} แล้ว` : "ไม่มีคิวที่ผ่าน triage และรอเรียกในขณะนี้");
      void utils.frontDesk.listQueue.invalidate();
    },
  });
  const selected = queue.data?.find(item => item.visitId === selectedVisitId) ?? queue.data?.[0] ?? null;

  async function callNextPatient() {
    setError(null);
    setNotice(null);
    try {
      await callNext.mutateAsync(queryInput);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถเรียกคิวถัดไปได้");
    }
  }

  if (!canReadQueue) return <AccessDenied title="คัดกรองและคิว" detail="หน้านี้สงวนสำหรับผู้ช่วยคลินิกและแพทย์ และจะไม่เรียกข้อมูลคิวสำหรับบทบาทของคุณ" />;

  return (
    <div className="mx-auto max-w-[1480px] space-y-5 text-[#17312F]">
      <header className="rounded-[22px] border border-[#D5E3DD] bg-[#EAF4F0] px-5 py-5 sm:px-7"><p className="font-mono text-[11px] font-bold tracking-[0.14em] text-[#0B6B67]">TRIAGE / QUEUE</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">คัดกรองและจัดการคิว</h1><p className="mt-1 text-sm text-[#5C726C]">แสดงเฉพาะรายการที่ผู้ใช้งานสร้างในวันที่เลือก และเปลี่ยนสถานะผ่าน workflow ที่ได้รับอนุญาต</p></div><div className="flex items-center gap-2"><label className="text-sm font-semibold text-[#344C46]"><span className="sr-only">วันที่คิว</span><input type="date" value={queueDate} onChange={event => { setQueueDate(event.target.value); setSelectedVisitId(null); }} className="h-10 rounded-xl border border-[#ACCBC4] bg-white px-3 text-sm outline-none focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10" /></label><button onClick={() => void queue.refetch()} className="grid h-10 w-10 place-items-center rounded-xl border border-[#ACCBC4] bg-white text-[#0B6B67] transition hover:bg-[#F7FCFA]" aria-label="รีเฟรชคิว"><RefreshCw size={16} /></button>{user?.role === "DOCTOR" && <button disabled={callNext.isPending} onClick={() => void callNextPatient()} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#17312F] px-4 text-sm font-semibold text-white transition hover:bg-[#244942] disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]"><BellRing size={16} />{callNext.isPending ? "กำลังเรียก…" : "เรียกคิวถัดไป"}</button>}</div></div></header>
      {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-[#E7C9C1] bg-[#FFF3F0] text-[#A13C2F]" : "border-[#CBE1D8] bg-[#F2F8F5] text-[#276451]"}`}>{error || notice}</p>}
      <div className="grid gap-5 xl:grid-cols-[minmax(330px,0.72fr)_minmax(0,1.28fr)]">
        <section className="overflow-hidden rounded-[20px] border border-[#DCE5DF] bg-[#FDFCF9] shadow-[0_10px_30px_rgba(23,49,47,0.04)]"><div className="border-b border-[#E4EBE6] px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#DDF0EA] text-[#0B6B67]"><UsersRound size={18} /></span><div><h2 className="font-semibold">คิวของวัน</h2><p className="mt-0.5 text-xs text-[#71837E]">ลำดับคิวเป็นผลจากการสร้าง visit จริง</p></div></div></div><div className="max-h-[650px] space-y-2 overflow-y-auto p-3">{queue.isLoading && <EmptyQueue detail="กำลังอ่านรายการคิว…" icon={RefreshCw} />}{!queue.isLoading && queue.data?.length === 0 && <EmptyQueue detail="ยังไม่มีรายการคิวในวันที่เลือก" icon={UsersRound} />}{queue.data?.map(item => <button key={item.queueId} type="button" onClick={() => setSelectedVisitId(item.visitId)} className={`w-full rounded-xl border p-3.5 text-left transition hover:border-[#8CBCAE] hover:bg-[#F6FBF8] ${selected?.visitId === item.visitId ? "border-[#0B6B67] bg-[#EDF7F3]" : "border-[#E1E8E3] bg-white"}`}><div className="flex items-start gap-3"><span className="grid h-10 min-w-10 place-items-center rounded-lg bg-[#17312F] font-mono text-sm font-bold text-white">{String(item.queueNumber).padStart(2, "0")}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><p className="truncate font-semibold">{item.firstName} {item.lastName}</p><p className="mt-0.5 font-mono text-[11px] font-bold tracking-wide text-[#0B6B67]">{item.hn}</p></div><StatusBadge status={item.queueStatus} /></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-[#61766F]">{item.chiefComplaint}</p>{item.triageUrgency && <p className={`mt-2 text-[11px] font-semibold ${item.triageUrgency === "URGENT" ? "text-[#B04636]" : item.triageUrgency === "PRIORITY" ? "text-[#A16422]" : "text-[#437669]"}`}>{urgencyLabel[item.triageUrgency]}</p>}</div></div></button>)}</div></section>
        <section className="rounded-[20px] border border-[#DCE5DF] bg-[#FDFCF9] p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">{selected ? <><QueueDetail key={selected.visitId} item={selected as QueueItem} role={user!.role} queueDate={queueDate} onSuccess={() => void utils.frontDesk.listQueue.invalidate()} />{user?.role === "DOCTOR" && selected.assignedTo === user.id && selected.queueStatus === "CALLED" && selected.visitStatus === "IN_CONSULT" && <button type="button" onClick={() => setLocation(`/doctor-console/${selected.visitId}`)} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-[#17312F] px-4 text-sm font-semibold text-white transition hover:bg-[#244942] active:scale-[0.98]"><Stethoscope size={16} />เปิดห้องตรวจสำหรับรายการนี้</button>}</> : <EmptyQueue detail="เลือกผู้รับบริการจากรายการคิวเพื่อดูหรือบันทึก triage" icon={ClipboardCheck} />}</section>
      </div>
    </div>
  );
}

function QueueDetail({ item, role, queueDate, onSuccess }: { item: QueueItem; role: "ASSISTANT" | "DOCTOR" | "SYSTEM_ADMIN"; queueDate: string; onSuccess: () => void }) {
  const [fields, setFields] = useState({ systolic: item.bloodPressureSystolic?.toString() ?? "", diastolic: item.bloodPressureDiastolic?.toString() ?? "", pulse: item.pulse?.toString() ?? "", temperature: item.temperatureCelsius ?? "", oxygen: item.oxygenSaturation?.toString() ?? "", weight: item.weightKg ?? "", height: item.heightCm ?? "", note: item.triageNote ?? "", urgency: item.triageUrgency ?? "ROUTINE" as Urgency });
  const [error, setError] = useState<string | null>(null);
  const recordTriage = trpc.frontDesk.recordTriage.useMutation({ onSuccess });
  const canTriage = role === "ASSISTANT" && ["REGISTERED", "TRIAGED", "WAITING_DOCTOR"].includes(item.visitStatus);

  async function submitTriage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      await recordTriage.mutateAsync({ visitId: item.visitId, bloodPressureSystolic: optionalInteger(fields.systolic), bloodPressureDiastolic: optionalInteger(fields.diastolic), pulse: optionalInteger(fields.pulse), temperatureCelsius: fields.temperature || null, oxygenSaturation: optionalInteger(fields.oxygen), weightKg: fields.weight || null, heightCm: fields.height || null, triageNote: fields.note || undefined, urgency: fields.urgency });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึก triage ได้");
    }
  }

  return <div><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E4EBE6] pb-4"><div className="flex items-start gap-3"><span className="grid h-11 min-w-11 place-items-center rounded-xl bg-[#17312F] font-mono text-base font-bold text-white">{String(item.queueNumber).padStart(2, "0")}</span><div><p className="font-mono text-[11px] font-bold tracking-wide text-[#0B6B67]">{item.hn}</p><h2 className="mt-0.5 text-xl font-semibold">{item.firstName} {item.lastName}</h2><p className="mt-1 text-sm text-[#61766F]">อาการสำคัญ: {item.chiefComplaint}</p></div></div><div className="text-right"><StatusBadge status={item.queueStatus} /><p className="mt-2 text-xs text-[#71837E]">เรียกเมื่อ {formatTime(item.calledAt)}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><InfoBox label="สถานะ visit" value={item.visitStatus} /><InfoBox label="ระดับคัดกรอง" value={item.triageUrgency ? urgencyLabel[item.triageUrgency] : "ยังไม่บันทึก"} /><InfoBox label="บันทึกล่าสุด" value={formatTime(item.triagePerformedAt)} /></div>{error && <p role="alert" className="mt-4 rounded-xl border border-[#E7C9C1] bg-[#FFF3F0] px-3.5 py-3 text-sm text-[#A13C2F]">{error}</p>}<form onSubmit={submitTriage} className="mt-5"><div className="flex items-center gap-2"><Activity className="text-[#0B6B67]" size={18} /><h3 className="font-semibold">สัญญาณชีพและคัดกรอง</h3></div><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="ความดันบน" unit="mmHg" value={fields.systolic} onChange={value => setFields(current => ({ ...current, systolic: value }))} disabled={!canTriage} /><Metric label="ความดันล่าง" unit="mmHg" value={fields.diastolic} onChange={value => setFields(current => ({ ...current, diastolic: value }))} disabled={!canTriage} /><Metric label="ชีพจร" unit="bpm" value={fields.pulse} onChange={value => setFields(current => ({ ...current, pulse: value }))} disabled={!canTriage} /><Metric label="อุณหภูมิ" unit="°C" value={fields.temperature} onChange={value => setFields(current => ({ ...current, temperature: value }))} disabled={!canTriage} /><Metric label="SpO₂" unit="%" value={fields.oxygen} onChange={value => setFields(current => ({ ...current, oxygen: value }))} disabled={!canTriage} /><Metric label="น้ำหนัก" unit="kg" value={fields.weight} onChange={value => setFields(current => ({ ...current, weight: value }))} disabled={!canTriage} /><Metric label="ส่วนสูง" unit="cm" value={fields.height} onChange={value => setFields(current => ({ ...current, height: value }))} disabled={!canTriage} /><label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#526861]">ความเร่งด่วน</span><select value={fields.urgency} disabled={!canTriage} onChange={event => setFields(current => ({ ...current, urgency: event.target.value as Urgency }))} className="h-10 w-full rounded-xl border border-[#D7E1DB] bg-white px-3 text-sm outline-none disabled:cursor-not-allowed disabled:bg-[#F3F5F3] focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10"><option value="ROUTINE">ปกติ</option><option value="PRIORITY">เร่งด่วน</option><option value="URGENT">ต้องพบแพทย์โดยเร็ว</option></select></label></div><label className="mt-3 block"><span className="mb-1.5 block text-xs font-semibold text-[#526861]">หมายเหตุการคัดกรอง</span><textarea disabled={!canTriage} value={fields.note} onChange={event => setFields(current => ({ ...current, note: event.target.value }))} rows={4} placeholder="บันทึกเฉพาะข้อมูลที่เกี่ยวข้องกับการคัดกรอง" className="w-full rounded-xl border border-[#D7E1DB] bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-[#9AA9A3] disabled:cursor-not-allowed disabled:bg-[#F3F5F3] focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10" /></label>{canTriage ? <button disabled={recordTriage.isPending} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B6B67] px-4 text-sm font-semibold text-white transition hover:bg-[#095B58] disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]"><ClipboardCheck size={16} />{recordTriage.isPending ? "กำลังบันทึก…" : item.triagePerformedAt ? "ปรับปรุง triage" : "บันทึก triage"}</button> : <p className="mt-4 rounded-xl bg-[#F2F6F3] px-3.5 py-3 text-sm text-[#5E746D]">{role === "DOCTOR" ? "แพทย์สามารถดูข้อมูล triage และเรียกคิวถัดไปได้ แต่ไม่สามารถแก้ไขข้อมูลคัดกรอง" : "สถานะของ visit นี้ไม่อนุญาตให้บันทึก triage เพิ่ม"}</p>}</form><p className="mt-5 border-t border-[#E4EBE6] pt-4 text-xs text-[#74877F]">วันที่คิว: {queueDate} · การบันทึกสำคัญจะสร้าง audit event โดยไม่คัดลอกเนื้อหาทางคลินิกลง metadata</p></div>;
}

function Metric({ label, unit, value, onChange, disabled }: { label: string; unit: string; value: string; onChange: (value: string) => void; disabled: boolean }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-semibold text-[#526861]">{label} <span className="font-normal text-[#899993]">{unit}</span></span><input disabled={disabled} inputMode="decimal" value={value} onChange={event => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-[#D7E1DB] bg-white px-3 text-sm outline-none disabled:cursor-not-allowed disabled:bg-[#F3F5F3] focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10" /></label>;
}

function StatusBadge({ status }: { status: QueueItem["queueStatus"] }) {
  const tone = status === "WAITING" ? "bg-[#FFF4E8] text-[#9B5D20]" : status === "CALLED" || status === "IN_CONSULT" ? "bg-[#E8F3F8] text-[#2A6683]" : "bg-[#EEF3F0] text-[#557268]";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{queueLabel[status]}</span>;
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[#E0E8E2] bg-[#FAFCFA] px-3.5 py-3"><p className="text-[11px] font-semibold text-[#778A83]">{label}</p><p className="mt-1 text-sm font-medium text-[#28463E]">{value}</p></div>;
}

function EmptyQueue({ detail, icon: Icon }: { detail: string; icon: typeof UsersRound }) {
  return <div className="grid min-h-[260px] place-items-center px-6 text-center"><div><Icon className="mx-auto text-[#0B6B67]" size={24} /><p className="mt-3 text-sm text-[#647A72]">{detail}</p></div></div>;
}
