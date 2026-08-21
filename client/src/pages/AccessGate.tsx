import { trpc } from "@/lib/trpc";
import { LockKeyhole, ShieldCheck, Stethoscope } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { SESSION_EXPIRED_NOTICE_KEY } from "@/lib/sessionExpiry";

const initialFields = { username: "", password: "", displayName: "", setupKey: "" };

export default function AccessGate({ onAuthenticated }: { onAuthenticated?: () => void }) {
  const utils = trpc.useUtils();
  const setup = trpc.auth.setupStatus.useQuery();
  const [fields, setFields] = useState(initialFields);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpiredNotice] = useState(() => sessionStorage.getItem(SESSION_EXPIRED_NOTICE_KEY) === "1");
  const isSetup = Boolean(setup.data?.requiresSetup);
  const login = trpc.auth.login.useMutation({ onSuccess: user => utils.auth.me.setData(undefined, user) });
  const bootstrap = trpc.auth.bootstrap.useMutation({ onSuccess: user => utils.auth.me.setData(undefined, user) });

  useEffect(() => {
    setError(null);
  }, [isSetup]);

  useEffect(() => {
    if (sessionExpiredNotice) sessionStorage.removeItem(SESSION_EXPIRED_NOTICE_KEY);
  }, [sessionExpiredNotice]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    try {
      if (isSetup) {
        await bootstrap.mutateAsync({
          username: fields.username,
          password: fields.password,
          displayName: fields.displayName,
          setupKey: fields.setupKey,
        });
      } else {
        await login.mutateAsync({ username: fields.username, password: fields.password });
      }
      await utils.auth.me.invalidate();
      onAuthenticated?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถเข้าสู่ระบบได้");
    }
  }

  const pending = login.isPending || bootstrap.isPending || setup.isLoading;

  return (
    <main className="min-h-screen bg-[#F7F5EF] px-5 py-8 text-[#17312F] sm:px-8">
      <div className="pointer-events-none fixed inset-0 opacity-[0.18] [background-image:radial-gradient(#0B6B67_0.55px,transparent_0.55px)] [background-size:14px_14px]" />
      <section className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl overflow-hidden rounded-[28px] border border-[#D8E3DE] bg-[#FDFCF8] shadow-[0_24px_60px_rgba(23,49,47,0.12)] lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative flex flex-col justify-between overflow-hidden bg-[#0B6B67] p-7 text-white sm:p-10">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(184,219,215,0.28),transparent_42%)]" />
          <div className="relative flex items-center gap-3"><img className="h-12 w-12 rounded-2xl" src="/clinic-mark.svg" alt="โลโก้คลินิกหมอพัลลภ" /><div><p className="font-semibold">คลินิกหมอพัลลภ</p><p className="font-mono text-[10px] font-bold tracking-[0.17em] text-[#B8DBD7]">HIS · CARE ROUTE</p></div></div>
          <div className="relative py-10"><div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><Stethoscope size={23} /></div><h1 className="max-w-sm text-3xl font-semibold leading-tight tracking-[-0.04em]">เริ่มงานจากจุดที่ปลอดภัย</h1><p className="mt-4 max-w-sm text-sm leading-6 text-white/75">ระบบเริ่มต้นใช้บัญชีบุคลากรแบบชื่อผู้ใช้และรหัสผ่าน ข้อมูลผู้ป่วยจริงจะยังไม่ถูกเปิดใช้ในขั้นต้นนี้</p></div>
          <div className="relative border-t border-white/15 pt-5"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-[#B8DBD7]" size={18} /><p className="text-xs leading-5 text-white/75">Session เป็น HTTP-only cookie และระบบจะเก็บเฉพาะ password hash ที่ผ่านการคำนวณแบบ scrypt เท่านั้น</p></div></div>
        </div>
        <div className="flex items-center p-7 sm:p-10"><div className="w-full max-w-md"><p className="font-mono text-[11px] font-bold tracking-[0.14em] text-[#0B6B67]">{isSetup ? "SYSTEM BOOTSTRAP" : "STAFF SIGN IN"}</p><h2 className="mt-3 text-2xl font-semibold tracking-tight">{isSetup ? "ตั้งค่าบัญชีผู้ดูแลคนแรก" : "เข้าสู่ระบบเพื่อเริ่มงาน"}</h2><p className="mt-2 text-sm leading-6 text-[#71837E]">{isSetup ? "ใช้รหัสตั้งค่าระบบที่ผู้ดูแลเก็บไว้อย่างปลอดภัย การตั้งค่านี้ทำได้เพียงครั้งเดียว" : "ใช้ชื่อผู้ใช้และรหัสผ่านของบุคลากรคลินิก"}</p>
          <form onSubmit={submit} className="mt-8 space-y-4">
            {sessionExpiredNotice && <p role="status" className="rounded-xl border border-[#B9DCD7] bg-[#EDF8F6] px-3.5 py-3 text-sm text-[#0B6B67]">ช่วงเวลาการเข้าสู่ระบบสิ้นสุดลงแล้ว เพื่อความปลอดภัย โปรดลงชื่อเข้าใช้อีกครั้ง</p>}
            {isSetup && <Field label="ชื่อที่แสดง" value={fields.displayName} onChange={value => setFields(current => ({ ...current, displayName: value }))} autoComplete="name" placeholder="เช่น พญ. พัลลภ" />}
            <Field label="ชื่อผู้ใช้" value={fields.username} onChange={value => setFields(current => ({ ...current, username: value }))} autoComplete="username" placeholder="เช่น clinic.admin" />
            <Field label="รหัสผ่าน" value={fields.password} onChange={value => setFields(current => ({ ...current, password: value }))} autoComplete={isSetup ? "new-password" : "current-password"} type="password" placeholder="อย่างน้อย 12 ตัวอักษร" />
            {isSetup && <Field label="รหัสตั้งค่าระบบ" value={fields.setupKey} onChange={value => setFields(current => ({ ...current, setupKey: value }))} autoComplete="off" type="password" placeholder="รหัสใช้ครั้งเดียว" />}
            {error && <p role="alert" className="rounded-xl border border-[#E7C9C1] bg-[#FFF3F0] px-3.5 py-3 text-sm text-[#A13C2F]">{error}</p>}
            <button disabled={pending || !setup.data} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B6B67] px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(11,107,103,0.2)] transition hover:bg-[#095B58] disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]">{pending ? "กำลังตรวจสอบ…" : <><LockKeyhole size={16} />{isSetup ? "สร้างบัญชีผู้ดูแล" : "เข้าสู่ระบบ"}</>}</button>
          </form>
          <p className="mt-6 text-xs leading-5 text-[#7B8D87]">หากคุณไม่มีบัญชีหรือรหัสตั้งค่าระบบ โปรดติดต่อผู้ดูแลคลินิก ไม่ควรส่งรหัสผ่านผ่านแชตหรือเอกสารที่เข้าถึงได้ทั่วไป</p>
        </div></div>
      </section>
    </main>
  );
}

function Field({ label, value, onChange, type = "text", autoComplete, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; autoComplete: string; placeholder: string }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-[#344C46]">{label}</span><input required value={value} onChange={event => onChange(event.target.value)} type={type} autoComplete={autoComplete} placeholder={placeholder} className="h-11 w-full rounded-xl border border-[#D7E1DB] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#A2B0AA] focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10" /></label>;
}
