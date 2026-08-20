import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { readNationalIdFromLocalSmartCardBridge } from "@/lib/smartCardBridge";
import { AlertTriangle, CalendarPlus, CheckCircle2, CreditCard, Info, Lock, Search, ShieldAlert, UserPlus, UsersRound, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useLocation } from "wouter";

type Gender = "MALE" | "FEMALE" | "OTHER" | "UNSPECIFIED";
type PatientChoice = {
  id: number;
  hn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string | null;
};

type DuplicateCandidate = {
  id: number;
  hn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  phone: string | null;
  createdAt: Date;
};

const blankRegistration = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  gender: "UNSPECIFIED" as Gender,
  phone: "",
  address: "",
  allergySummary: "",
  nationalId: "",
  consentAccepted: false,
};

function todayInBrowser() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function ageFromDate(dateOfBirth: string) {
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "-";
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age -= 1;
  return `${Math.max(0, age)} ปี`;
}

function displayGender(gender: Gender) {
  return { MALE: "ชาย", FEMALE: "หญิง", OTHER: "อื่น ๆ", UNSPECIFIED: "ไม่ระบุ" }[gender];
}

export default function FrontDesk() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();
  const [registration, setRegistration] = useState(blankRegistration);
  const [searchText, setSearchText] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<PatientChoice | null>(null);
  const [visitDate, setVisitDate] = useState(todayInBrowser);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [nationalIdInput, setNationalIdInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Duplicate warning modal state
  const [duplicateWarning, setDuplicateWarning] = useState<DuplicateCandidate[] | null>(null);

  const searchInput = useMemo(() => ({ query: submittedSearch }), [submittedSearch]);
  const nationalIdStatusInput = useMemo(() => ({ patientId: selectedPatient?.id ?? 0 }), [selectedPatient?.id]);
  const canUseFrontDesk = user?.role === "ASSISTANT";

  const patientSearch = trpc.frontDesk.searchPatients.useQuery(searchInput, { enabled: canUseFrontDesk && submittedSearch.length > 0 });
  const registerPatient = trpc.frontDesk.registerPatient.useMutation({
    onSuccess: patient => {
      setSelectedPatient(patient);
      setRegistration(blankRegistration);
      setDuplicateWarning(null);
      setNotice(`ลงทะเบียนสำเร็จ: ${patient.hn}`);
      void utils.frontDesk.searchPatients.invalidate();
    },
  });

  const createVisit = trpc.frontDesk.createVisit.useMutation({
    onSuccess: result => {
      setChiefComplaint("");
      setNotice(`สร้างรายการรับบริการแล้ว: คิว ${result.queueNumber}`);
      void utils.frontDesk.listQueue.invalidate();
    },
  });

  const nationalIdStatus = trpc.frontDesk.nationalIdStatus.useQuery(nationalIdStatusInput, { enabled: canUseFrontDesk && Boolean(selectedPatient?.id) });
  const recordNationalId = trpc.frontDesk.recordNationalId.useMutation({
    onSuccess: result => {
      setNationalIdInput("");
      setNotice(`บันทึกเลขบัตรประชาชนแล้ว: ${result.nationalIdMasked}`);
      void utils.frontDesk.nationalIdStatus.invalidate();
    },
  });

  async function executeRegistration() {
    setError(null);
    setNotice(null);
    try {
      await registerPatient.mutateAsync(registration);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถลงทะเบียนผู้รับบริการได้");
    }
  }

  async function submitRegistration(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!registration.consentAccepted) {
      setError("กรุณายินยอมให้จัดเก็บและประมวลผลข้อมูลตามนโยบายความเป็นส่วนตัว (PDPA)");
      return;
    }

    try {
      // Check for duplicate patients before proceeding
      const duplicates = await utils.frontDesk.checkDuplicates.fetch({
        firstName: registration.firstName,
        lastName: registration.lastName,
        dateOfBirth: registration.dateOfBirth || null,
      });

      if (duplicates && duplicates.length > 0) {
        setDuplicateWarning(duplicates);
        return;
      }

      await executeRegistration();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถลงทะเบียนผู้รับบริการได้");
    }
  }

  async function submitVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient) return;
    setError(null);
    setNotice(null);
    try {
      await createVisit.mutateAsync({ patientId: selectedPatient.id, visitDate, chiefComplaint });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถสร้างรายการรับบริการได้");
    }
  }

  async function readFromSmartCard() {
    setError(null);
    try {
      const nationalId = await readNationalIdFromLocalSmartCardBridge();
      setNationalIdInput(nationalId);
      setNotice("อ่านเลขบัตรจาก Local Smart Card Bridge แล้ว โปรดตรวจสอบและกดบันทึก");
    } catch (cause) {
      if (cause instanceof Error && cause.message === "SMART_CARD_BRIDGE_UNAVAILABLE") {
        setError("ไม่พบ Local Smart Card Bridge บนอุปกรณ์นี้ กรุณากรอกเลขบัตรประชาชนเอง");
      } else {
        setError("ไม่สามารถอ่านเลขบัตรจาก Smart Card ได้ กรุณาตรวจเครื่องอ่านและบัตร แล้วลองใหม่");
      }
    }
  }

  async function submitNationalId(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedPatient) return;
    setError(null);
    try {
      await recordNationalId.mutateAsync({ patientId: selectedPatient.id, nationalId: nationalIdInput, source: "ASSISTANT_ENTRY" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกเลขบัตรประชาชนได้");
    }
  }

  if (!canUseFrontDesk) return <AccessDenied title="ลงทะเบียนผู้รับบริการ" detail="หน้านี้สงวนสิทธิ์สำหรับผู้ช่วยคลินิก และจะไม่เรียกข้อมูลผู้รับบริการสำหรับบทบาทของคุณ" />;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 text-[#17312F]">
      <header className="rounded-[22px] border border-[#D5E3DD] bg-[#EAF4F0] px-5 py-5 sm:px-7">
        <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-[#0B6B67]">FRONT DESK / HN</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ลงทะเบียนและเปิดรายการรับบริการ</h1>
            <p className="mt-1 text-sm text-[#5C726C]">ค้นหาข้อมูลที่มีอยู่ก่อน และบันทึกเฉพาะข้อมูลที่ผู้ใช้งานกรอกเอง</p>
          </div>
          <button onClick={() => setLocation("/queue")} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#A9CBC3] bg-white px-4 text-sm font-semibold text-[#0B6B67] transition hover:bg-[#F7FCFA] active:scale-[0.98]">
            <CalendarPlus size={16} />เปิดคิววันนี้
          </button>
        </div>
      </header>

      {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-[#E7C9C1] bg-[#FFF3F0] text-[#A13C2F]" : "border-[#CBE1D8] bg-[#F2F8F5] text-[#276451]"}`}>{error || notice}</p>}

      {/* Duplicate Warning Dialog / Modal */}
      {duplicateWarning && duplicateWarning.length > 0 && (
        <div className="rounded-[20px] border-2 border-[#E5A84D] bg-[#FFFBF0] p-5 shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FDE7C4] text-[#A86400]">
                <AlertTriangle size={20} />
              </span>
              <div>
                <h2 className="text-base font-bold text-[#7C4A03]">แจ้งเตือน: ตรวจพบข้อมูลผู้รับบริการที่อาจซ้ำซ้อน</h2>
                <p className="mt-1 text-xs text-[#8A5F1C]">
                  พบผู้รับบริการ {duplicateWarning.length} รายการที่มีชื่อหรือวันเกิดตรงกับข้อมูลที่กำลังลงทะเบียน โปรดตรวจสอบก่อนสร้าง HN ใหม่
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setDuplicateWarning(null)} className="rounded-lg p-1.5 text-[#8A5F1C] hover:bg-[#FDE7C4]">
              <X size={18} />
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {duplicateWarning.map(dup => (
              <div key={dup.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#EDD5A8] bg-white p-3">
                <div>
                  <p className="font-semibold text-[#17312F]">
                    {dup.firstName} {dup.lastName}{" "}
                    <span className="ml-1 font-mono text-xs font-bold text-[#0B6B67]">{dup.hn}</span>
                  </p>
                  <p className="text-xs text-[#71837E]">
                    วันเกิด: {dup.dateOfBirth} ({ageFromDate(dup.dateOfBirth)}) · เพศ: {displayGender(dup.gender)} {dup.phone ? `· โทร: ${dup.phone}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient(dup);
                    setDuplicateWarning(null);
                    setNotice(`เลือกใช้ข้อมูลเดิม: ${dup.hn}`);
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0B6B67] px-3 text-xs font-semibold text-white transition hover:bg-[#095B58]"
                >
                  <CheckCircle2 size={14} /> เลือกใช้ HN เดิมนี้
                </button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-3 border-t border-[#EDD5A8] pt-3">
            <button
              type="button"
              onClick={() => setDuplicateWarning(null)}
              className="rounded-xl border border-[#D5DCD8] bg-white px-4 py-2 text-xs font-semibold text-[#576E67] hover:bg-[#F5F8F6]"
            >
              ยกเลิก / แก้ไขข้อมูล
            </button>
            <button
              type="button"
              disabled={registerPatient.isPending}
              onClick={() => void executeRegistration()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#BA5939] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#9E462A]"
            >
              <UserPlus size={14} /> ยืนยันสร้าง HN ใหม่ (คนละบุคคล)
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        {/* Search Patient Section */}
        <section className="rounded-[20px] border border-[#DCE5DF] bg-[#FDFCF9] p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#DDF0EA] text-[#0B6B67]"><Search size={19} /></span>
            <div>
              <h2 className="font-semibold">ค้นหาผู้รับบริการ</h2>
              <p className="mt-0.5 text-xs leading-5 text-[#71837E]">ค้นหาด้วย HN ชื่อ หรือนามสกุล เพื่อหลีกเลี่ยงการสร้างระเบียนซ้ำ</p>
            </div>
          </div>
          <form onSubmit={event => { event.preventDefault(); setSubmittedSearch(searchText.trim()); }} className="mt-4 flex gap-2">
            <input value={searchText} onChange={event => setSearchText(event.target.value)} placeholder="HN, ชื่อ หรือนามสกุล" className="h-11 min-w-0 flex-1 rounded-xl border border-[#D6E1DB] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#9AA9A3] focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10" />
            <button className="h-11 rounded-xl bg-[#0B6B67] px-4 text-sm font-semibold text-white transition hover:bg-[#095B58] active:scale-[0.98]">ค้นหา</button>
          </form>
          <div className="mt-4 space-y-2">
            {patientSearch.isFetching && <p className="rounded-xl bg-[#F2F6F3] px-3.5 py-3 text-sm text-[#58716A]">กำลังค้นหา…</p>}
            {submittedSearch && !patientSearch.isFetching && patientSearch.data?.length === 0 && (
              <p className="rounded-xl border border-dashed border-[#D4E1DA] px-3.5 py-5 text-center text-sm text-[#637A73]">ไม่พบรายการจากคำค้นนี้ คุณสามารถลงทะเบียนใหม่ได้หลังตรวจสอบชื่อและ HN แล้ว</p>
            )}
            {patientSearch.data?.map(patient => (
              <button type="button" key={patient.id} onClick={() => { setSelectedPatient(patient); setNotice(`เลือก ${patient.hn} แล้ว`); setError(null); }} className={`w-full rounded-xl border px-3.5 py-3 text-left transition hover:border-[#86B8AB] hover:bg-[#F5FAF7] ${selectedPatient?.id === patient.id ? "border-[#0B6B67] bg-[#EDF7F3]" : "border-[#E0E7E2] bg-white"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold">{patient.firstName} {patient.lastName}</p>
                    <p className="mt-1 font-mono text-xs font-bold tracking-wide text-[#0B6B67]">{patient.hn}</p>
                  </div>
                  <p className="text-xs text-[#71837E]">{ageFromDate(patient.dateOfBirth)} · {displayGender(patient.gender)}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* New Patient Registration Section */}
        <section className="rounded-[20px] border border-[#DCE5DF] bg-[#FDFCF9] p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF0E8] text-[#BA5939]"><UserPlus size={19} /></span>
            <div>
              <h2 className="font-semibold">ลงทะเบียนผู้รับบริการใหม่</h2>
              <p className="mt-0.5 text-xs leading-5 text-[#71837E]">ข้อมูลนี้จะถูกบันทึกเมื่อกดปุ่มเท่านั้น และระบบจะสร้าง HN หลังสำเร็จ</p>
            </div>
          </div>

          <form onSubmit={submitRegistration} className="mt-5 grid gap-4 sm:grid-cols-2">
            <InputField label="ชื่อ" value={registration.firstName} onChange={value => setRegistration(current => ({ ...current, firstName: value }))} required />
            <InputField label="นามสกุล" value={registration.lastName} onChange={value => setRegistration(current => ({ ...current, lastName: value }))} required />
            <InputField label="วันเกิด" value={registration.dateOfBirth} onChange={value => setRegistration(current => ({ ...current, dateOfBirth: value }))} type="date" required />
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#344C46]">เพศ</span>
              <select value={registration.gender} onChange={event => setRegistration(current => ({ ...current, gender: event.target.value as Gender }))} className="h-11 w-full rounded-xl border border-[#D7E1DB] bg-white px-3 text-sm outline-none focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10">
                <option value="UNSPECIFIED">ไม่ระบุ</option>
                <option value="MALE">ชาย</option>
                <option value="FEMALE">หญิง</option>
                <option value="OTHER">อื่น ๆ</option>
              </select>
            </label>
            <InputField label="โทรศัพท์" value={registration.phone} onChange={value => setRegistration(current => ({ ...current, phone: value }))} inputMode="tel" />
            <InputField label="ข้อมูลแพ้ยา / ข้อควรระวัง" value={registration.allergySummary} onChange={value => setRegistration(current => ({ ...current, allergySummary: value }))} />
            <div className="sm:col-span-2">
              <InputField label="เลขบัตรประชาชน (ไม่บังคับ)" value={registration.nationalId} onChange={value => setRegistration(current => ({ ...current, nationalId: value }))} inputMode="numeric" />
              <p className="mt-1.5 text-xs leading-5 text-[#71837E]">บันทึกครั้งเดียวและแก้ไขไม่ได้ภายหลัง ระบบจะแสดงเฉพาะ 2 หลักแรกและ 3 หลักท้าย</p>
            </div>
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-[#344C46]">ที่อยู่</span>
              <textarea value={registration.address} onChange={event => setRegistration(current => ({ ...current, address: event.target.value }))} rows={2} className="w-full rounded-xl border border-[#D7E1DB] bg-white px-3.5 py-2.5 text-sm outline-none focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10" />
            </label>

            {/* PDPA Privacy Notice & Consent Checkbox */}
            <div className="sm:col-span-2 rounded-xl border border-[#B8D9D0] bg-[#F2F9F5] p-3.5 text-xs text-[#2F524A]">
              <div className="flex items-start gap-2">
                <Lock size={15} className="mt-0.5 shrink-0 text-[#0B6B67]" />
                <div>
                  <p className="font-semibold text-[#17312F]">การคุ้มครองข้อมูลส่วนบุคคล (PDPA)</p>
                  <p className="mt-1 leading-5 text-[#4D6962]">
                    ข้อมูลสุขภาพและประวัติการรักษาของผู้รับบริการจะถูกจัดเก็บเป็นความลับเพื่อประโยชน์ในการรักษาพยาบาลและการบริหารจัดการภายในคลินิกเท่านั้น
                  </p>
                  <label className="mt-2.5 flex cursor-pointer items-center gap-2 font-medium text-[#17312F]">
                    <input
                      type="checkbox"
                      checked={registration.consentAccepted}
                      onChange={event => setRegistration(current => ({ ...current, consentAccepted: event.target.checked }))}
                      className="h-4 w-4 rounded border-[#9CBFB6] text-[#0B6B67] focus:ring-[#0B6B67]"
                    />
                    <span>ผู้รับบริการได้รับทราบและยินยอมให้จัดเก็บข้อมูลสุขภาพตามนโยบายความเป็นส่วนตัว</span>
                  </label>
                </div>
              </div>
            </div>

            <button
              disabled={registerPatient.isPending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0B6B67] px-4 text-sm font-semibold text-white transition hover:bg-[#095B58] disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98] sm:col-span-2"
            >
              <UserPlus size={16} />
              {registerPatient.isPending ? "กำลังบันทึก…" : "บันทึกและสร้าง HN"}
            </button>
          </form>
        </section>
      </div>

      {/* Open Visit Section */}
      <section className="rounded-[20px] border border-[#D5E3DD] bg-white p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF4F0] text-[#0B6B67]"><CalendarPlus size={19} /></span>
            <div>
              <h2 className="font-semibold">เปิดรายการรับบริการ</h2>
              <p className="mt-0.5 text-xs leading-5 text-[#71837E]">เมื่อบันทึกสำเร็จ ระบบจะเพิ่มรายการเข้าสู่คิวของวันนั้นตามลำดับจริง</p>
            </div>
          </div>
          {selectedPatient && (
            <div className="rounded-xl border border-[#B8D9D0] bg-[#F2F9F5] px-3.5 py-2">
              <p className="text-xs text-[#5B756D]">ผู้รับบริการที่เลือก</p>
              <p className="mt-0.5 font-semibold">
                {selectedPatient.firstName} {selectedPatient.lastName}{" "}
                <span className="ml-1 font-mono text-xs text-[#0B6B67]">{selectedPatient.hn}</span>
              </p>
            </div>
          )}
        </div>

        {selectedPatient ? (
          <form onSubmit={submitVisit} className="mt-5 grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_auto]">
            <InputField label="วันที่รับบริการ" value={visitDate} onChange={setVisitDate} type="date" required />
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-[#344C46]">อาการสำคัญ</span>
              <input
                required
                value={chiefComplaint}
                onChange={event => setChiefComplaint(event.target.value)}
                placeholder="กรอกอาการสำคัญตามที่ผู้รับบริการแจ้ง"
                className="h-11 w-full rounded-xl border border-[#D7E1DB] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#9AA9A3] focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10"
              />
            </label>
            <button disabled={createVisit.isPending} className="mt-[29px] inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#17312F] px-4 text-sm font-semibold text-white transition hover:bg-[#244942] disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]">
              <CalendarPlus size={16} />{createVisit.isPending ? "กำลังเปิดรายการ…" : "เปิดรายการ"}
            </button>
          </form>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-[#D4E1DA] px-4 py-6 text-center text-sm text-[#6D827B]">
            <UsersRound className="mx-auto mb-2 text-[#0B6B67]" size={20} />
            ค้นหาหรือบันทึกผู้รับบริการ แล้วเลือกหนึ่งรายการเพื่อเปิด visit
          </div>
        )}
      </section>

      {/* National ID Section */}
      {selectedPatient && (
        <section className="rounded-[20px] border border-[#D5E3DD] bg-[#FDFCF9] p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF4F0] text-[#0B6B67]"><CreditCard size={19} /></span>
            <div>
              <h2 className="font-semibold">เลขบัตรประชาชน</h2>
              <p className="mt-0.5 text-xs leading-5 text-[#71837E]">บันทึกเฉพาะเมื่อจำเป็นสำหรับงานทะเบียน ข้อมูลจะเข้ารหัส และเมื่อบันทึกแล้วไม่สามารถแก้ไขได้</p>
            </div>
          </div>
          {nationalIdStatus.isLoading ? (
            <p className="mt-4 rounded-xl bg-[#F2F6F3] px-3.5 py-3 text-sm text-[#58716A]">กำลังตรวจสถานะเลขบัตร…</p>
          ) : nationalIdStatus.data?.isSet ? (
            <div className="mt-4 rounded-xl border border-[#B8D9D0] bg-[#F2F9F5] px-4 py-3">
              <p className="text-xs text-[#5B756D]">เลขบัตรประชาชนที่บันทึกไว้</p>
              <p className="mt-1 font-mono text-sm font-bold tracking-wide text-[#0B6B67]">{nationalIdStatus.data.nationalIdMasked}</p>
              <p className="mt-1 text-xs text-[#5B756D]">ข้อมูลนี้ถูกล็อกและไม่สามารถแก้ไขได้</p>
            </div>
          ) : (
            <form onSubmit={submitNationalId} className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
              <label className="block">
                <span className="sr-only">เลขบัตรประชาชน</span>
                <input required inputMode="numeric" value={nationalIdInput} onChange={event => setNationalIdInput(event.target.value)} placeholder="กรอกเลขบัตรประชาชน 13 หลัก" className="h-11 w-full rounded-xl border border-[#D7E1DB] bg-white px-3.5 text-sm outline-none transition placeholder:text-[#9AA9A3] focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10" />
              </label>
              <button type="button" onClick={readFromSmartCard} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#A9CBC3] bg-white px-4 text-sm font-semibold text-[#0B6B67] transition hover:bg-[#F7FCFA] active:scale-[0.98]">
                <CreditCard size={16} />อ่าน Smart Card
              </button>
              <button disabled={recordNationalId.isPending} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#0B6B67] px-4 text-sm font-semibold text-white transition hover:bg-[#095B58] disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]">
                {recordNationalId.isPending ? "กำลังบันทึก…" : "บันทึกแบบล็อก"}
              </button>
              <p className="sm:col-span-3 text-xs leading-5 text-[#71837E]">ปุ่ม Smart Card ใช้ Local Smart Card Bridge ที่คลินิกติดตั้งไว้เท่านั้น หากไม่มีอุปกรณ์ ให้กรอกด้วยตนเอง</p>
            </form>
          )}
        </section>
      )}
    </div>
  );
}

function InputField({ label, value, onChange, type = "text", required, inputMode }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; inputMode?: "tel" | "numeric" | "decimal" }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-[#344C46]">{label}</span>
      <input required={required} type={type} inputMode={inputMode} value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-[#D7E1DB] bg-white px-3.5 text-sm outline-none transition focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10" />
    </label>
  );
}

export function AccessDenied({ title, detail }: { title: string; detail: string }) {
  return (
    <section className="mx-auto grid min-h-[480px] max-w-2xl place-items-center rounded-[22px] border border-[#E7D4CE] bg-[#FFF9F7] px-6 text-center">
      <div>
        <ShieldAlert className="mx-auto text-[#A44B3B]" size={30} />
        <h1 className="mt-4 text-xl font-semibold">ไม่มีสิทธิ์เข้าถึง: {title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#795A53]">{detail}</p>
      </div>
    </section>
  );
}

