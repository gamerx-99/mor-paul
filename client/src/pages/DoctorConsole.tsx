import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AccessDenied } from "@/pages/FrontDesk";
import { CheckCircle2, ClipboardPenLine, FileCheck2, HeartPulse, Pill, Plus, Save, ShieldAlert, Stethoscope } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useLocation, useRoute } from "wouter";

type NoteFields = { subjective: string; objective: string; assessment: string; plan: string };
type DiagnosisDraft = { code: string; display: string };
type MedicationDraft = { medicationId: string; dose: string; frequency: string; duration: string; quantityPrescribed: string; instructions: string };

const emptyNote: NoteFields = { subjective: "", objective: "", assessment: "", plan: "" };
const emptyMedication: MedicationDraft = { medicationId: "", dose: "", frequency: "", duration: "", quantityPrescribed: "", instructions: "" };

function safeDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function metric(value: string | number | null | undefined, unit: string) {
  return value === null || value === undefined || value === "" ? "-" : `${value} ${unit}`;
}

export default function DoctorConsole() {
  const { user } = useAuth();
  const [, params] = useRoute("/doctor-console/:visitId");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const visitId = params?.visitId && /^\d+$/.test(params.visitId) ? Number(params.visitId) : null;
  const [note, setNote] = useState<NoteFields>(emptyNote);
  const [revision, setRevision] = useState(0);
  const [diagnoses, setDiagnoses] = useState<DiagnosisDraft[]>([{ code: "", display: "" }]);
  const [medications, setMedications] = useState<MedicationDraft[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canUseConsole = user?.role === "DOCTOR";
  const consultation = trpc.doctorConsole.getConsultation.useQuery({ visitId: visitId ?? 0 }, { enabled: canUseConsole && visitId !== null });
  const medicationCatalog = trpc.pharmacy.catalog.search.useQuery({ query: "" }, { enabled: canUseConsole });

  useEffect(() => {
    if (!consultation.data) return;
    setNote({
      subjective: consultation.data.note?.subjective ?? "",
      objective: consultation.data.note?.objective ?? "",
      assessment: consultation.data.note?.assessment ?? "",
      plan: consultation.data.note?.plan ?? "",
    });
    setRevision(consultation.data.note?.revision ?? 0);
    setDiagnoses(consultation.data.diagnoses.length ? consultation.data.diagnoses.map(item => ({ code: item.code ?? "", display: item.display })) : [{ code: "", display: "" }]);
  }, [consultation.data]);

  const saveDraft = trpc.doctorConsole.saveDraft.useMutation({
    onSuccess: result => {
      setRevision(result.revision);
      setNotice("บันทึกฉบับร่างแล้ว ข้อมูลยังไม่ถูกลงนาม");
      void utils.doctorConsole.getConsultation.invalidate();
    },
  });
  const signEncounter = trpc.doctorConsole.signEncounter.useMutation({
    onSuccess: () => {
      setNotice("ลงนามการตรวจแล้ว และส่งต่อระบบการเงินเพื่อออกบิลและรับชำระ");
      void utils.frontDesk.listQueue.invalidate();
      void utils.doctorConsole.getConsultation.invalidate();
    },
  });

  if (!canUseConsole) return <AccessDenied title="ห้องตรวจ" detail="หน้านี้สงวนสิทธิ์สำหรับแพทย์ และจะไม่เรียกข้อมูลเวชระเบียนสำหรับบทบาทของคุณ" />;
  if (visitId === null) return <SelectFromQueue onGoToQueue={() => setLocation("/queue")} />;

  async function submitDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null); setNotice(null);
    try {
      await saveDraft.mutateAsync({ visitId: visitId!, expectedRevision: revision, ...note });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกฉบับร่างได้"); }
  }

  async function submitSignature() {
    if (!consultation.data) return;
    const cleanedDiagnoses = diagnoses.map(item => ({ code: item.code.trim() || undefined, display: item.display.trim() })).filter(item => item.display.length > 0);
    if (!cleanedDiagnoses.length) { setError("กรุณาระบุการวินิจฉัยอย่างน้อยหนึ่งรายการก่อนลงนาม"); return; }
    const incompleteMedication = medications.some(item => !item.medicationId || !item.dose.trim() || !item.frequency.trim() || !Number.isInteger(Number(item.quantityPrescribed)) || Number(item.quantityPrescribed) < 1);
    if (incompleteMedication) { setError("กรุณาระบุยา ขนาดยา ความถี่ และจำนวนให้ครบ หรือเอารายการที่ไม่ใช้ออก"); return; }
    const cleanedMedications = medications.map(item => ({ medicationId: Number(item.medicationId), dose: item.dose.trim(), frequency: item.frequency.trim(), duration: item.duration.trim() || undefined, quantityPrescribed: Number(item.quantityPrescribed), instructions: item.instructions.trim() || undefined }));
    setError(null); setNotice(null);
    try {
      await signEncounter.mutateAsync({ visitId: visitId!, expectedRevision: revision, expectedVisitVersion: consultation.data.visitVersion, ...note, diagnoses: cleanedDiagnoses, medications: cleanedMedications });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "ไม่สามารถลงนามปิดการตรวจได้"); }
  }

  if (consultation.isLoading) return <ConsoleState icon={Stethoscope} title="กำลังเปิดห้องตรวจ" detail="กำลังตรวจสิทธิ์และโหลดเฉพาะ encounter ที่ได้รับมอบหมายให้คุณ" />;
  if (consultation.error || !consultation.data) return <ConsoleState icon={ShieldAlert} title="ไม่สามารถเปิดห้องตรวจ" detail={consultation.error?.message ?? "ไม่พบรายการตรวจที่เข้าถึงได้"} actionLabel="กลับไปคิว" onAction={() => setLocation("/queue")} danger />;
  const item = consultation.data;
  const signed = item.note?.status === "SIGNED";

  return <div className="mx-auto max-w-[1500px] space-y-5 text-[#17312F]">
    <header className="rounded-[22px] border border-[#D5E3DD] bg-[#EAF4F0] px-5 py-5 sm:px-7"><p className="font-mono text-[11px] font-bold tracking-[0.14em] text-[#0B6B67]">DOCTOR CONSOLE / ACTIVE ENCOUNTER</p><div className="mt-2 flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">ห้องตรวจ</h1><p className="mt-1 text-sm text-[#5C726C]">บันทึกข้อมูลจาก encounter ที่ระบบมอบหมายให้แพทย์ผู้ใช้งานเท่านั้น</p></div><button onClick={() => setLocation("/queue")} className="h-10 rounded-xl border border-[#A9CBC3] bg-white px-4 text-sm font-semibold text-[#0B6B67] transition hover:bg-[#F7FCFA] active:scale-[0.98]">กลับไปคิว</button></div></header>
    {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-[#E7C9C1] bg-[#FFF3F0] text-[#A13C2F]" : "border-[#CBE1D8] bg-[#F2F8F5] text-[#276451]"}`}>{error || notice}</p>}
    <section className="rounded-[20px] border border-[#D5E3DD] bg-white p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="font-mono text-[12px] font-bold tracking-wide text-[#0B6B67]">{item.hn}</p><h2 className="mt-1 text-2xl font-semibold">{item.firstName} {item.lastName}</h2><p className="mt-1 text-sm text-[#60756E]">วันเกิด {safeDate(item.dateOfBirth)} · {item.gender === "MALE" ? "ชาย" : item.gender === "FEMALE" ? "หญิง" : "ไม่ระบุ"}</p></div><div className="max-w-xl rounded-xl border border-[#F0D9C9] bg-[#FFF8F3] px-4 py-3 text-sm"><p className="font-semibold text-[#8C462B]">แพ้ยา / ข้อควรระวัง</p><p className="mt-1 leading-5 text-[#73584E]">{item.allergySummary || "ยังไม่ได้บันทึก"}</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><DataBox label="อาการสำคัญ" value={item.chiefComplaint} /><DataBox label="ความดัน" value={item.bloodPressureSystolic && item.bloodPressureDiastolic ? `${item.bloodPressureSystolic}/${item.bloodPressureDiastolic} mmHg` : "-"} /><DataBox label="ชีพจร / SpO₂" value={`${metric(item.pulse, "bpm")} · ${metric(item.oxygenSaturation, "%")}`} /><DataBox label="อุณหภูมิ / น้ำหนัก" value={`${metric(item.temperatureCelsius, "°C")} · ${metric(item.weightKg, "kg")}`} /></div>{item.triageNote && <p className="mt-4 rounded-xl bg-[#F3F7F5] px-4 py-3 text-sm leading-6 text-[#4B625B]"><span className="font-semibold">หมายเหตุ triage: </span>{item.triageNote}</p>}</section>
    <form onSubmit={submitDraft} className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.58fr)]"><section className="rounded-[20px] border border-[#DCE5DF] bg-[#FDFCF9] p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#DDF0EA] text-[#0B6B67]"><ClipboardPenLine size={19} /></span><div><h2 className="font-semibold">บันทึกการตรวจ</h2><p className="mt-0.5 text-xs leading-5 text-[#71837E]">บันทึกฉบับร่างแก้ไขได้จนกว่าจะลงนาม การลงนามจะปิด encounter และป้องกันการแก้ไข</p></div></div><div className="mt-5 grid gap-4">{([ ["subjective", "S · Subjective", "อาการหรือข้อมูลที่ผู้รับบริการแจ้ง"], ["objective", "O · Objective", "ผลตรวจหรือข้อสังเกต"], ["assessment", "A · Assessment", "การประเมินของแพทย์"], ["plan", "P · Plan", "แผนการดูแล / คำแนะนำ"] ] as const).map(([key, label, hint]) => <label key={key} className="block"><span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-semibold text-[#344C46]"><span>{label}</span><span className="text-xs font-normal text-[#85958F]">{hint}</span></span><textarea disabled={signed} value={note[key]} onChange={event => setNote(current => ({ ...current, [key]: event.target.value }))} rows={key === "plan" ? 4 : 3} className="w-full rounded-xl border border-[#D7E1DB] bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[#9AA9A3] disabled:cursor-not-allowed disabled:bg-[#F3F5F3] focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10" placeholder={hint} /></label>)}</div>{!signed && <button disabled={saveDraft.isPending} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-[#0B6B67] bg-white px-4 text-sm font-semibold text-[#0B6B67] transition hover:bg-[#F0F8F5] disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]"><Save size={16} />{saveDraft.isPending ? "กำลังบันทึก…" : "บันทึกฉบับร่าง"}</button>}</section>
      <section className="rounded-[20px] border border-[#DCE5DF] bg-[#FDFCF9] p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]"><div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF0E8] text-[#BA5939]"><FileCheck2 size={19} /></span><div><h2 className="font-semibold">การวินิจฉัยและการลงนาม</h2><p className="mt-0.5 text-xs leading-5 text-[#71837E]">กรอกคำวินิจฉัยตามการประเมินจริงก่อนลงนามส่งต่อระบบการเงิน</p></div></div><div className="mt-5 space-y-3">{diagnoses.map((diagnosis, index) => <div key={index} className="rounded-xl border border-[#E1E8E3] bg-white p-3"><div className="flex gap-2"><label className="min-w-0 flex-1"><span className="mb-1 block text-xs font-semibold text-[#526861]">คำวินิจฉัย</span><input disabled={signed} required value={diagnosis.display} onChange={event => setDiagnoses(current => current.map((item, row) => row === index ? { ...item, display: event.target.value } : item))} className="h-10 w-full rounded-lg border border-[#D7E1DB] px-3 text-sm outline-none disabled:bg-[#F3F5F3] focus:border-[#0B6B67]" /></label><label className="w-28"><span className="mb-1 block text-xs font-semibold text-[#526861]">รหัส (ถ้ามี)</span><input disabled={signed} value={diagnosis.code} onChange={event => setDiagnoses(current => current.map((item, row) => row === index ? { ...item, code: event.target.value } : item))} className="h-10 w-full rounded-lg border border-[#D7E1DB] px-3 text-sm outline-none disabled:bg-[#F3F5F3] focus:border-[#0B6B67]" /></label></div>{!signed && diagnoses.length > 1 && <button type="button" onClick={() => setDiagnoses(current => current.filter((_, row) => row !== index))} className="mt-2 text-xs font-semibold text-[#A44B3B]">ลบรายการนี้</button>}</div>)}</div>{!signed && <button type="button" onClick={() => setDiagnoses(current => [...current, { code: "", display: "" }])} className="mt-3 text-sm font-semibold text-[#0B6B67]">+ เพิ่มการวินิจฉัย</button>}{!signed && <MedicationOrders catalog={medicationCatalog.data ?? []} medications={medications} onChange={setMedications} />}{signed ? <div className="mt-5 rounded-xl border border-[#CBE1D8] bg-[#F2F8F5] p-4 text-sm text-[#276451]"><CheckCircle2 className="mb-2" size={18} /><p className="font-semibold">ลงนามแล้ว</p><p className="mt-1 leading-5">บันทึกฉบับนี้ถูกปิดเพื่อป้องกันการแก้ไข และได้ส่งต่อระบบการเงิน โปรดออกบิลและรับชำระก่อนปิดงาน</p></div> : <div className="mt-5 rounded-xl border border-[#F0D9C9] bg-[#FFF8F3] p-4"><div className="flex gap-2 text-sm text-[#8C462B]"><ShieldAlert size={17} className="mt-0.5 shrink-0" /><p>{medications.length ? "การลงนามจะส่งรายการยาและ encounter ไปยัง Cashier เพื่อจ่ายยา เพิ่มค่าบริการ ออกบิล และรับชำระ" : "การลงนามจะส่ง encounter ไปยัง Cashier เพื่อเพิ่มค่าบริการ (ถ้ามี) ออกบิล และรับชำระก่อนปิดงาน"}</p></div><button type="button" disabled={signEncounter.isPending} onClick={() => void submitSignature()} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17312F] px-4 text-sm font-semibold text-white transition hover:bg-[#244942] disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]"><FileCheck2 size={16} />{signEncounter.isPending ? "กำลังลงนาม…" : "ลงนามและส่งต่อการเงิน"}</button></div>}</section></form>
  </div>;
}

function SelectFromQueue({ onGoToQueue }: { onGoToQueue: () => void }) { return <ConsoleState icon={HeartPulse} title="เลือก encounter จากคิว" detail="เปิดคิววันนี้ แล้วเลือกเฉพาะรายการที่แพทย์เรียกและได้รับมอบหมายให้ตนเอง" actionLabel="เปิดคิววันนี้" onAction={onGoToQueue} />; }
function ConsoleState({ icon: Icon, title, detail, actionLabel, onAction, danger }: { icon: typeof Stethoscope; title: string; detail: string; actionLabel?: string; onAction?: () => void; danger?: boolean }) { return <section className={`mx-auto grid min-h-[480px] max-w-2xl place-items-center rounded-[22px] border px-6 text-center ${danger ? "border-[#E7D4CE] bg-[#FFF9F7]" : "border-[#D5E3DD] bg-[#F7FCFA]"}`}><div><Icon className={`mx-auto ${danger ? "text-[#A44B3B]" : "text-[#0B6B67]"}`} size={30} /><h1 className="mt-4 text-xl font-semibold">{title}</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#60756E]">{detail}</p>{actionLabel && onAction && <button onClick={onAction} className="mt-5 h-10 rounded-xl bg-[#0B6B67] px-4 text-sm font-semibold text-white transition hover:bg-[#095B58] active:scale-[0.98]">{actionLabel}</button>}</div></section>; }
function DataBox({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#E1E8E3] bg-[#FDFEFD] px-3.5 py-3"><p className="text-[11px] font-semibold tracking-wide text-[#75877F]">{label}</p><p className="mt-1 text-sm font-semibold text-[#334B45]">{value}</p></div>; }
function MedicationOrders({ catalog, medications, onChange }: { catalog: Array<{ id: number; code: string; genericName: string; dosageForm: string; strength: string }>; medications: MedicationDraft[]; onChange: (next: MedicationDraft[]) => void }) { return <section className="mt-5 border-t border-[#E1E8E3] pt-5"><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-2"><Pill className="text-[#0B6B67]" size={18} /><div><h3 className="font-semibold">คำสั่งยา</h3><p className="text-xs text-[#71837E]">เลือกเฉพาะยาที่ผู้ดูแลระบบบันทึกและเปิดใช้งานแล้ว</p></div></div><button type="button" onClick={() => onChange([...medications, emptyMedication])} className="inline-flex items-center gap-1 text-sm font-semibold text-[#0B6B67]"><Plus size={16} />เพิ่มยา</button></div>{!medications.length ? <p className="mt-3 rounded-xl bg-[#F3F7F5] px-3 py-3 text-xs text-[#60756E]">ไม่มีคำสั่งยา ระบบจะยังส่ง encounter ไป Cashier เพื่อออกบิลและรับชำระก่อนปิดงาน</p> : <div className="mt-3 space-y-3">{medications.map((medication, index) => <div key={index} className="rounded-xl border border-[#E1E8E3] bg-white p-3"><div className="grid gap-2 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[#526861]">ยา</span><select value={medication.medicationId} onChange={event => onChange(medications.map((item, row) => row === index ? { ...item, medicationId: event.target.value } : item))} className="h-10 w-full rounded-lg border border-[#D7E1DB] bg-white px-3 text-sm"><option value="">เลือกยา</option>{catalog.map(item => <option key={item.id} value={item.id}>{item.code} · {item.genericName} {item.strength}</option>)}</select></label>{([ ["dose", "ขนาดยา", "เช่น 1 เม็ด"], ["frequency", "ความถี่", "เช่น วันละ 2 ครั้ง"], ["duration", "ระยะเวลา", "ถ้ามี"], ["quantityPrescribed", "จำนวน", "จำนวนเต็ม"] ] as const).map(([field, label, placeholder]) => <label key={field}><span className="mb-1 block text-xs font-semibold text-[#526861]">{label}</span><input inputMode={field === "quantityPrescribed" ? "numeric" : undefined} value={medication[field]} placeholder={placeholder} onChange={event => onChange(medications.map((item, row) => row === index ? { ...item, [field]: event.target.value } : item))} className="h-10 w-full rounded-lg border border-[#D7E1DB] px-3 text-sm" /></label>)}<label className="sm:col-span-2"><span className="mb-1 block text-xs font-semibold text-[#526861]">คำแนะนำ (ถ้ามี)</span><input value={medication.instructions} onChange={event => onChange(medications.map((item, row) => row === index ? { ...item, instructions: event.target.value } : item))} className="h-10 w-full rounded-lg border border-[#D7E1DB] px-3 text-sm" /></label></div><button type="button" onClick={() => onChange(medications.filter((_, row) => row !== index))} className="mt-2 text-xs font-semibold text-[#A44B3B]">ลบคำสั่งยานี้</button></div>)}</div>}</section>; }
