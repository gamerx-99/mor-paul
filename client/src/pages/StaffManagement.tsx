import { useAuth } from "@/_core/hooks/useAuth";
import { AccessDenied } from "@/pages/FrontDesk";
import { trpc } from "@/lib/trpc";
import React, { FormEvent, useState } from "react";
import { BadgeCheck, ShieldCheck, UserCog, UserMinus, UserPlus, UsersRound } from "lucide-react";

type StaffRole = "SYSTEM_ADMIN" | "DOCTOR" | "ASSISTANT";

const roleLabel: Record<StaffRole, string> = {
  SYSTEM_ADMIN: "ผู้ดูแลระบบ",
  DOCTOR: "แพทย์",
  ASSISTANT: "ผู้ช่วย",
};

const blankAccount = { username: "", displayName: "", password: "", role: "ASSISTANT" as StaffRole };

export function initialPasswordStrength(password: string) {
  const classes = [/[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^\w\s]/.test(password)].filter(Boolean).length;
  const lengthValid = password.length >= 12 && password.length <= 128;
  const passes = lengthValid && (password.length >= 16 || classes >= 3);
  if (!password) return { label: "ยังไม่ได้ตรวจ", detail: "กรอกรหัสผ่านเพื่อให้ระบบตรวจสอบ", tone: "text-[#71837E]", width: "w-0", passes: false };
  if (passes) return { label: "ผ่านเกณฑ์", detail: password.length >= 16 ? "ผ่านด้วยความยาวตั้งแต่ 16 ตัวอักษร" : `ผ่านด้วยความยาว ${password.length} ตัวอักษร และ ${classes} กลุ่มอักขระ`, tone: "text-[#276451]", width: "w-full", passes: true };
  const missing = !lengthValid ? "ต้องยาว 12–128 ตัวอักษร" : `ต้องมีอย่างน้อย 3 กลุ่มอักขระ (ขณะนี้ ${classes}/4)`;
  return { label: "ยังไม่ผ่านเกณฑ์", detail: missing, tone: "text-[#A13C2F]", width: password.length >= 12 ? "w-2/3" : "w-1/3", passes: false };
}

function displayDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: "short" }).format(value) : "ยังไม่เคยเข้าสู่ระบบ";
}

export default function StaffManagement() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const canManageStaff = user?.role === "SYSTEM_ADMIN";
  const [account, setAccount] = useState(blankAccount);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const passwordStrength = initialPasswordStrength(account.password);
  const staffQuery = trpc.staff.list.useQuery(undefined, { enabled: canManageStaff });
  const createAccount = trpc.staff.create.useMutation({
    onSuccess: created => {
      setAccount(blankAccount);
      setNotice(`สร้างบัญชี ${created.username} แล้ว`);
      void utils.staff.list.invalidate();
    },
  });
  const changeRole = trpc.staff.changeRole.useMutation({ onSuccess: () => void utils.staff.list.invalidate() });
  const setActive = trpc.staff.setActive.useMutation({ onSuccess: () => void utils.staff.list.invalidate() });

  async function submitAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    try {
      await createAccount.mutateAsync(account);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถสร้างบัญชีบุคลากรได้");
    }
  }

  async function updateRole(userId: number, role: StaffRole) {
    setError(null);
    setNotice(null);
    try {
      await changeRole.mutateAsync({ userId, role });
      setNotice("ปรับบทบาทบัญชีแล้ว");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถปรับบทบาทบัญชีได้");
    }
  }

  async function toggleAccount(userId: number, isActive: boolean) {
    setError(null);
    setNotice(null);
    try {
      await setActive.mutateAsync({ userId, isActive: !isActive });
      setNotice(isActive ? "ปิดใช้บัญชีและเพิกถอน session แล้ว" : "เปิดใช้บัญชีแล้ว");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถเปลี่ยนสถานะบัญชีได้");
    }
  }

  if (!canManageStaff) return <AccessDenied title="บัญชีบุคลากร" detail="หน้านี้สงวนสิทธิ์สำหรับผู้ดูแลระบบ และไม่เรียกข้อมูลบัญชีบุคลากรสำหรับบทบาทของคุณ" />;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 text-[#17312F]">
      <header className="rounded-[22px] border border-[#D8E3DF] bg-[#F3F7F4] px-5 py-5 sm:px-7">
        <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-[#416A60]">SYSTEM ADMIN / ZERO-PHI</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div><h1 className="text-2xl font-semibold tracking-tight">บัญชีบุคลากร</h1><p className="mt-1 max-w-2xl text-sm text-[#5C726C]">จัดการเฉพาะชื่อบัญชี บทบาท และสถานะการใช้งาน ระบบไม่แสดงข้อมูลผู้รับบริการหรือข้อมูลทางคลินิกในหน้านี้</p></div>
          <span className="inline-flex items-center gap-2 rounded-xl border border-[#C9DDD5] bg-white px-3.5 py-2 text-xs font-semibold text-[#37685B]"><ShieldCheck size={15} />ขอบเขต Zero-PHI</span>
        </div>
      </header>

      {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-[#E7C9C1] bg-[#FFF3F0] text-[#A13C2F]" : "border-[#CBE1D8] bg-[#F2F8F5] text-[#276451]"}`}>{error || notice}</p>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)]">
        <section className="rounded-[20px] border border-[#DCE5DF] bg-[#FDFCF9] p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#E4EFEA] text-[#416A60]"><UserPlus size={19} /></span><div><h2 className="font-semibold">สร้างบัญชีบุคลากร</h2><p className="mt-0.5 text-xs leading-5 text-[#71837E]">กำหนดรหัสผ่านเริ่มต้นอย่างน้อย 12 ตัวอักษร ระบบจะบันทึกเฉพาะ password hash</p></div></div>
          <form onSubmit={submitAccount} className="mt-5 grid gap-4">
            <StaffInput label="ชื่อผู้ใช้" value={account.username} onChange={value => setAccount(current => ({ ...current, username: value }))} autoComplete="username" placeholder="ตัวอย่าง: nurse.mali" required />
            <StaffInput label="ชื่อที่แสดง" value={account.displayName} onChange={value => setAccount(current => ({ ...current, displayName: value }))} required />
            <div>
              <StaffInput label="รหัสผ่านเริ่มต้น" value={account.password} onChange={value => setAccount(current => ({ ...current, password: value }))} type="password" autoComplete="new-password" required />
              <div className="mt-2 rounded-xl border border-[#DCE5DF] bg-[#F7FAF8] p-3" aria-live="polite">
                <div className="flex items-center justify-between gap-3 text-xs font-semibold"><span className="text-[#526A62]">ความแข็งแรงของรหัสผ่าน</span><span className={passwordStrength.tone}>{passwordStrength.label}</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#DDE7E2]"><div className={`h-full rounded-full transition-all ${passwordStrength.passes ? "bg-[#3B806A]" : "bg-[#C06B58]"} ${passwordStrength.width}`} /></div>
                <p className={`mt-2 text-xs leading-5 ${passwordStrength.tone}`}>{passwordStrength.detail}</p>
                <p className="mt-1 text-xs leading-5 text-[#71837E]">ต้องยาว 12–128 ตัวอักษร; หากสั้นกว่า 16 ตัว ให้ใช้ครบอย่างน้อย 3 กลุ่ม: a–z, A–Z, 0–9 และอักขระพิเศษ</p>
              </div>
            </div>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-[#344C46]">บทบาท</span><select value={account.role} onChange={event => setAccount(current => ({ ...current, role: event.target.value as StaffRole }))} className="h-11 w-full rounded-xl border border-[#D7E1DB] bg-white px-3 text-sm outline-none focus:border-[#416A60] focus:ring-4 focus:ring-[#416A60]/10"><option value="ASSISTANT">ผู้ช่วย</option><option value="DOCTOR">แพทย์</option><option value="SYSTEM_ADMIN">ผู้ดูแลระบบ</option></select></label>
            <button disabled={createAccount.isPending} className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#416A60] px-4 text-sm font-semibold text-white transition hover:bg-[#315349] disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]"><UserPlus size={16} />{createAccount.isPending ? "กำลังสร้างบัญชี…" : "สร้างบัญชีบุคลากร"}</button>
          </form>
        </section>

        <section className="rounded-[20px] border border-[#DCE5DF] bg-white p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
          <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#ECF4F0] text-[#416A60]"><UsersRound size={19} /></span><div><h2 className="font-semibold">รายการบัญชี</h2><p className="mt-0.5 text-xs leading-5 text-[#71837E]">การปิดใช้บัญชีจะเพิกถอน session ที่ยังใช้งานอยู่ทันที ไม่สามารถปิดใช้หรือเปลี่ยนบทบาทของบัญชีตนเองจากหน้านี้</p></div></div>
          <div className="mt-5 overflow-x-auto rounded-xl border border-[#E0E7E2]">
            <table className="min-w-[760px] w-full text-sm"><thead className="bg-[#F5F8F6] text-left text-xs font-semibold tracking-wide text-[#5B7169]"><tr><th className="px-4 py-3">บุคลากร</th><th className="px-4 py-3">บทบาท</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">เข้าสู่ระบบล่าสุด</th><th className="px-4 py-3 text-right">การจัดการ</th></tr></thead><tbody>
              {staffQuery.isLoading && <tr><td colSpan={5} className="px-4 py-8 text-center text-[#71837E]">กำลังโหลดรายการบัญชี…</td></tr>}
              {staffQuery.isError && <tr><td colSpan={5} className="px-4 py-8 text-center text-[#A13C2F]">ไม่สามารถโหลดรายการบัญชีได้</td></tr>}
              {!staffQuery.isLoading && !staffQuery.isError && staffQuery.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[#71837E]">ยังไม่มีบัญชีบุคลากรเพิ่มเติม</td></tr>}
              {staffQuery.data?.map(accountRow => {
                const isCurrentUser = accountRow.id === user.id;
                const isPending = changeRole.isPending || setActive.isPending;
                return <tr key={accountRow.id} className="border-t border-[#E6ECE8] align-middle"><td className="px-4 py-3"><p className="font-semibold">{accountRow.displayName}</p><p className="mt-0.5 font-mono text-xs text-[#71837E]">{accountRow.username}{isCurrentUser ? " · บัญชีของคุณ" : ""}</p></td><td className="px-4 py-3"><select disabled={isCurrentUser || isPending} value={accountRow.role} onChange={event => void updateRole(accountRow.id, event.target.value as StaffRole)} aria-label={`เปลี่ยนบทบาท ${accountRow.username}`} className="h-9 rounded-lg border border-[#D7E1DB] bg-white px-2 text-xs disabled:cursor-not-allowed disabled:opacity-55"><option value="ASSISTANT">ผู้ช่วย</option><option value="DOCTOR">แพทย์</option><option value="SYSTEM_ADMIN">ผู้ดูแลระบบ</option></select><span className="sr-only">{roleLabel[accountRow.role]}</span></td><td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${accountRow.isActive ? "bg-[#E9F5EF] text-[#287052]" : "bg-[#F4ECE9] text-[#8C4C40]"}`}>{accountRow.isActive ? <BadgeCheck size={13} /> : <UserMinus size={13} />}{accountRow.isActive ? "ใช้งาน" : "ปิดใช้"}</span></td><td className="px-4 py-3 text-xs text-[#637A73]">{displayDate(accountRow.lastLoginAt)}</td><td className="px-4 py-3 text-right"><button type="button" disabled={isCurrentUser || isPending} onClick={() => void toggleAccount(accountRow.id, accountRow.isActive)} className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${accountRow.isActive ? "border-[#E2C4BB] bg-[#FFF8F5] text-[#9D4A38] hover:bg-[#FFF0EB]" : "border-[#B9D8CE] bg-[#F4FBF7] text-[#276451] hover:bg-[#EAF7F0]"}`}>{accountRow.isActive ? <UserMinus size={14} /> : <UserCog size={14} />}{accountRow.isActive ? "ปิดใช้" : "เปิดใช้"}</button></td></tr>;
              })}
            </tbody></table>
          </div>
        </section>
      </div>
    </div>
  );
}

function StaffInput({ label, value, onChange, type = "text", required, autoComplete, placeholder }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; autoComplete?: string; placeholder?: string }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-[#344C46]">{label}</span><input required={required} type={type} autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-[#D7E1DB] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#9AA9A3] focus:border-[#416A60] focus:ring-4 focus:ring-[#416A60]/10" /></label>;
}
