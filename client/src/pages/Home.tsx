import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import AccessGate from "@/pages/AccessGate";
import { BellRing, CalendarPlus, CheckCircle2, ClipboardList, FileBarChart, HeartPulse, LayoutDashboard, PackageOpen, RefreshCw, ShieldCheck, Stethoscope, UsersRound } from "lucide-react";
import React, { useMemo, useState } from "react";
import { useLocation } from "wouter";

type ClinicalRole = "ASSISTANT" | "DOCTOR";
type QueueStatus = "WAITING" | "CALLED" | "IN_CONSULT" | "COMPLETED" | "CANCELLED";

const queueStatusLabel: Record<QueueStatus, string> = {
  WAITING: "รอเรียก",
  CALLED: "เรียกแล้ว",
  IN_CONSULT: "กำลังตรวจ",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

const urgencyLabel = { ROUTINE: "ปกติ", PRIORITY: "เร่งด่วน", URGENT: "เร่งด่วนมาก" } as const;

export function canViewClinicalTransit(role: string | undefined): role is ClinicalRole {
  return role === "ASSISTANT" || role === "DOCTOR";
}

function todayInBrowser() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function Home() {
  const auth = useAuth();

  if (auth.loading) {
    return <main className="grid min-h-screen place-items-center bg-[#F7F5EF] text-sm font-medium text-[#54706A]">กำลังตรวจสอบ session…</main>;
  }
  if (!auth.user) return <AccessGate />;

  return <DashboardLayout><TransitBoard role={auth.user.role} /></DashboardLayout>;
}

function TransitBoard({ role }: { role: "SYSTEM_ADMIN" | "DOCTOR" | "ASSISTANT" }) {
  const [, setLocation] = useLocation();
  if (!canViewClinicalTransit(role)) return <PlatformOverview onNavigate={setLocation} />;
  return <ClinicalTransitBoard role={role} onNavigate={setLocation} />;
}

function ClinicalTransitBoard({ role, onNavigate }: { role: ClinicalRole; onNavigate: (path: string) => void }) {
  const utils = trpc.useUtils();
  const [queueDate] = useState(todayInBrowser);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const queueInput = useMemo(() => ({ queueDate }), [queueDate]);
  const queue = trpc.frontDesk.listQueue.useQuery(queueInput, { enabled: true, retry: false });
  const callNext = trpc.frontDesk.callNext.useMutation({
    onSuccess: result => {
      setNotice(result ? `เรียกคิว ${result.queueNumber} แล้ว` : "ไม่มีคิวที่ผ่าน triage และรอเรียกในขณะนี้");
      void utils.frontDesk.listQueue.invalidate();
    },
  });

  async function handleCallNext() {
    setActionError(null);
    setNotice(null);
    try {
      await callNext.mutateAsync(queueInput);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "ไม่สามารถเรียกคิวถัดไปได้");
    }
  }

  const items = queue.data ?? [];
  const waiting = items.filter(item => item.queueStatus === "WAITING").length;
  const triaged = items.filter(item => item.triagePerformedAt).length;
  const inConsult = items.filter(item => item.queueStatus === "IN_CONSULT").length;
  const actionable = items.filter(item => item.queueStatus !== "COMPLETED" && item.queueStatus !== "CANCELLED").slice(0, 6);

  return (
    <div className="mx-auto max-w-[1480px] space-y-5 text-[#17312F]">
      <section className="overflow-hidden rounded-[24px] border border-[#D5E3DD] bg-[#EAF4F0] shadow-[0_12px_30px_rgba(23,49,47,0.04)]">
        <div className="flex flex-col justify-between gap-5 px-5 py-6 sm:px-7 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.14em] text-[#0B6B67]"><span className="h-2 w-2 rounded-full bg-[#0B6B67]" />LIVE / CLINICAL TRANSIT</div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[28px]">เส้นทางการดูแลวันนี้</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#59716A]">แสดงคิวที่ผู้ใช้บันทึกจริงของวันที่ {new Date(`${queueDate}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" })} และเปลี่ยนสถานะผ่าน workflow ตามสิทธิ์ของคุณ</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {role === "ASSISTANT" && <ActionButton icon={CalendarPlus} label="ลงทะเบียน" onClick={() => onNavigate("/front-desk")} />}
            {role === "DOCTOR" && <ActionButton icon={BellRing} label={callNext.isPending ? "กำลังเรียก…" : "เรียกคิวถัดไป"} disabled={callNext.isPending} emphasis onClick={() => void handleCallNext()} />}
            <ActionButton icon={RefreshCw} label="รีเฟรช" disabled={queue.isFetching} onClick={() => void queue.refetch()} />
          </div>
        </div>
      </section>

      {(notice || actionError) && <p role={actionError ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${actionError ? "border-[#E7C9C1] bg-[#FFF3F0] text-[#A13C2F]" : "border-[#CBE1D8] bg-[#F2F8F5] text-[#276451]"}`}>{actionError || notice}</p>}

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric icon={UsersRound} label="คิวที่รอดำเนินการ" value={queue.isLoading ? "—" : waiting.toString()} note="สถานะรอเรียก" />
        <Metric icon={HeartPulse} label="คัดกรองแล้ว" value={queue.isLoading ? "—" : triaged.toString()} note="มีข้อมูล triage" />
        <Metric icon={Stethoscope} label="อยู่ระหว่างตรวจ" value={queue.isLoading ? "—" : inConsult.toString()} note="กำลังอยู่ในห้องตรวจ" />
      </section>

      <section className="overflow-hidden rounded-[20px] border border-[#DCE5DF] bg-[#FDFCF9] shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4EBE6] px-5 py-4">
          <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#DDF0EA] text-[#0B6B67]"><ClipboardList size={18} /></span><div><h2 className="font-semibold">คิวที่ต้องติดตาม</h2><p className="mt-0.5 text-xs text-[#71837E]">เฉพาะข้อมูลคิวจริงของผู้รับบริการที่อยู่ใน workflow วันนี้</p></div></div>
          <button type="button" onClick={() => onNavigate("/queue")} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#0B6B67] hover:bg-[#EDF7F3]">เปิด Queue Board</button>
        </div>
        {queue.isLoading && <BoardState icon={RefreshCw} title="กำลังอ่านคิววันนี้" detail="ระบบกำลังโหลดเฉพาะรายการที่คุณมีสิทธิ์เข้าถึง" />}
        {queue.isError && <BoardState icon={ShieldCheck} title="ไม่สามารถอ่านคิวได้" detail={queue.error.message || "โปรดลองรีเฟรชอีกครั้ง หรือแจ้งผู้ดูแลระบบ"} error />}
        {!queue.isLoading && !queue.isError && actionable.length === 0 && <BoardState icon={CheckCircle2} title="ยังไม่มีคิวที่ต้องดำเนินการ" detail="เมื่อมีการลงทะเบียนหรือสร้าง visit ผ่าน workflow จริง รายการจะปรากฏที่นี่" />}
        {!queue.isLoading && !queue.isError && actionable.length > 0 && <div className="divide-y divide-[#E8ECE8]">{actionable.map(item => <button key={item.queueId} type="button" onClick={() => onNavigate("/queue")} className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-[#F6FBF8]"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#17312F] font-mono text-sm font-bold text-white">{String(item.queueNumber).padStart(2, "0")}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="font-semibold">{item.firstName} {item.lastName}</span><span className="font-mono text-[11px] font-bold text-[#0B6B67]">{item.hn}</span></div><p className="mt-1 truncate text-xs text-[#61766F]">{item.chiefComplaint}</p></div><div className="flex shrink-0 flex-col items-end gap-1"><QueueChip status={item.queueStatus as QueueStatus} />{item.triageUrgency && <span className={`text-[11px] font-semibold ${item.triageUrgency === "URGENT" ? "text-[#B04636]" : item.triageUrgency === "PRIORITY" ? "text-[#A16422]" : "text-[#437669]"}`}>{urgencyLabel[item.triageUrgency]}</span>}</div></button>)}</div>}
      </section>
    </div>
  );
}

function PlatformOverview({ onNavigate }: { onNavigate: (path: string) => void }) {
  return <div className="mx-auto max-w-[1120px] space-y-5 text-[#17312F]"><section className="rounded-[24px] border border-[#D5E3DD] bg-[#EAF4F0] px-5 py-7 sm:px-7"><div className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.14em] text-[#0B6B67]"><ShieldCheck size={15} />PLATFORM / ZERO-PHI</div><h1 className="mt-3 text-2xl font-semibold tracking-tight">ศูนย์ปฏิบัติการผู้ดูแลระบบ</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#59716A]">เพื่อคงหลัก zero-PHI หน้านี้ไม่เรียกหรือแสดงคิว ข้อมูลผู้รับบริการ หรือข้อมูลเวชระเบียน คุณสามารถจัดการโครงสร้างระบบและดูรายงานสรุปที่ไม่ระบุตัวบุคคลได้</p></section><section className="grid gap-4 md:grid-cols-3"><PlatformCard icon={FileBarChart} title="รายงานสรุป" detail="ตัวเลข aggregate ตามสิทธิ์ โดยไม่มีข้อมูลระดับบุคคล" action="เปิดรายงาน" onClick={() => onNavigate("/reports")} /><PlatformCard icon={PackageOpen} title="คลังยาและราคา" detail="จัดการ catalog, ราคา และ lot ด้วยข้อมูลที่ผู้ใช้บันทึก" action="เปิดคลังยา" onClick={() => onNavigate("/medications")} /><PlatformCard icon={UsersRound} title="บัญชีบุคลากร" detail="จัดการบทบาทและสถานะบัญชี โดยไม่เข้าถึง PHI" action="เปิดบัญชีบุคลากร" onClick={() => onNavigate("/staff")} /></section><p className="rounded-xl border border-[#D6E5DE] bg-white/70 px-4 py-3 text-sm text-[#517069]">หากต้องการทำงานกับข้อมูลผู้รับบริการ ให้ใช้บัญชีบทบาท <strong>แพทย์</strong> หรือ <strong>ผู้ช่วย</strong> ตามหน้าที่ที่ได้รับอนุมัติ</p></div>;
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof UsersRound; label: string; value: string; note: string }) {
  return <section className="rounded-[18px] border border-[#DCE5DF] bg-[#FDFCF9] p-4 shadow-[0_8px_20px_rgba(23,49,47,0.03)]"><div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EAF4F0] text-[#0B6B67]"><Icon size={18} /></span><span className="text-2xl font-semibold tabular-nums">{value}</span></div><p className="mt-4 text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-[#71837E]">{note}</p></section>;
}

function ActionButton({ icon: Icon, label, onClick, emphasis, disabled }: { icon: typeof BellRing; label: string; onClick: () => void; emphasis?: boolean; disabled?: boolean }) {
  return <button type="button" disabled={disabled} onClick={onClick} className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 ${emphasis ? "border-[#17312F] bg-[#17312F] text-white hover:bg-[#244942]" : "border-[#ACCBC4] bg-white text-[#0B6B67] hover:bg-[#F7FCFA]"}`}><Icon size={16} />{label}</button>;
}

function QueueChip({ status }: { status: QueueStatus }) {
  const className = status === "IN_CONSULT" ? "bg-[#E5EEFA] text-[#315B88]" : status === "CALLED" ? "bg-[#FFF1D9] text-[#A16422]" : "bg-[#EAF4F0] text-[#276451]";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${className}`}>{queueStatusLabel[status]}</span>;
}

function BoardState({ icon: Icon, title, detail, error }: { icon: typeof RefreshCw; title: string; detail: string; error?: boolean }) {
  return <div className="grid min-h-56 place-items-center px-6 py-8 text-center"><div><span className={`mx-auto grid h-12 w-12 place-items-center rounded-2xl ${error ? "bg-[#FFF0ED] text-[#A13C2F]" : "bg-[#EAF4F0] text-[#0B6B67]"}`}><Icon size={22} /></span><h3 className="mt-4 font-semibold">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#71837D]">{detail}</p></div></div>;
}

function PlatformCard({ icon: Icon, title, detail, action, onClick }: { icon: typeof FileBarChart; title: string; detail: string; action: string; onClick: () => void }) {
  return <section className="rounded-[20px] border border-[#DCE5DF] bg-[#FDFCF9] p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF4F0] text-[#0B6B67]"><Icon size={19} /></span><h2 className="mt-5 font-semibold">{title}</h2><p className="mt-2 min-h-12 text-sm leading-6 text-[#61766F]">{detail}</p><button type="button" onClick={onClick} className="mt-5 text-sm font-semibold text-[#0B6B67] hover:underline">{action}</button></section>;
}
