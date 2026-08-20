import { useAuth } from "@/_core/hooks/useAuth";
import MedicalCertificatePrint from "@/components/documents/MedicalCertificatePrint";
import MedicationLabelPrint from "@/components/documents/MedicationLabelPrint";
import { trpc } from "@/lib/trpc";
import { AccessDenied } from "@/pages/FrontDesk";
import { searchIcd10, type Icd10Entry } from "@shared/icd10-data";
import { Bookmark, BookmarkPlus, Calendar, CheckCircle2, ChevronDown, ChevronUp, ClipboardList, ClipboardPenLine, FileCheck2, HeartPulse, History, Pill, Plus, Printer, Save, Search, ShieldAlert, Sparkles, Stethoscope, Trash2, User, X } from "lucide-react";
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
  const [activeTab, setActiveTab] = useState<"consultation" | "history">("consultation");

  // Print & Preset states
  const [showMedicalDocPrint, setShowMedicalDocPrint] = useState(false);
  const [showLabelPrint, setShowLabelPrint] = useState(false);
  const [showSavePresetModal, setShowSavePresetModal] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetDescription, setPresetDescription] = useState("");

  const canUseConsole = user?.role === "DOCTOR";
  const consultation = trpc.doctorConsole.getConsultation.useQuery({ visitId: visitId ?? 0 }, { enabled: canUseConsole && visitId !== null });
  const patientHistory = trpc.doctorConsole.getPatientHistory.useQuery(
    { patientId: consultation.data?.patientId ?? 0 },
    { enabled: canUseConsole && Boolean(consultation.data?.patientId) }
  );
  const medicationCatalog = trpc.pharmacy.catalog.search.useQuery({ query: "" }, { enabled: canUseConsole });
  const presets = trpc.doctorConsole.listPresets.useQuery(undefined, { enabled: canUseConsole });

  const createPreset = trpc.doctorConsole.createPreset.useMutation({
    onSuccess: () => {
      setNotice("บันทึกชุดคำสั่งด่วนเรียบร้อยแล้ว");
      void utils.doctorConsole.listPresets.invalidate();
      setShowSavePresetModal(false);
      setPresetName("");
      setPresetDescription("");
    },
  });

  const deletePreset = trpc.doctorConsole.deletePreset.useMutation({
    onSuccess: () => {
      setNotice("ลบชุดคำสั่งด่วนเรียบร้อยแล้ว");
      void utils.doctorConsole.listPresets.invalidate();
    },
  });

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
    setError(null);
    setNotice(null);
    try {
      await saveDraft.mutateAsync({ visitId: visitId!, expectedRevision: revision, ...note });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกฉบับร่างได้");
    }
  }

  async function submitSignature() {
    if (!consultation.data) return;
    const cleanedDiagnoses = diagnoses
      .map(item => ({ code: item.code.trim() || undefined, display: item.display.trim() }))
      .filter(item => item.display.length > 0);
    if (!cleanedDiagnoses.length) {
      setError("กรุณาระบุการวินิจฉัยอย่างน้อยหนึ่งรายการก่อนลงนาม");
      return;
    }
    const incompleteMedication = medications.some(
      item => !item.medicationId || !item.dose.trim() || !item.frequency.trim() || !Number.isInteger(Number(item.quantityPrescribed)) || Number(item.quantityPrescribed) < 1
    );
    if (incompleteMedication) {
      setError("กรุณาระบุยา ขนาดยา ความถี่ และจำนวนให้ครบ หรือเอารายการที่ไม่ใช้ออก");
      return;
    }
    const cleanedMedications = medications.map(item => ({
      medicationId: Number(item.medicationId),
      dose: item.dose.trim(),
      frequency: item.frequency.trim(),
      duration: item.duration.trim() || undefined,
      quantityPrescribed: Number(item.quantityPrescribed),
      instructions: item.instructions.trim() || undefined,
    }));
    setError(null);
    setNotice(null);
    try {
      await signEncounter.mutateAsync({
        visitId: visitId!,
        expectedRevision: revision,
        expectedVisitVersion: consultation.data.visitVersion,
        ...note,
        diagnoses: cleanedDiagnoses,
        medications: cleanedMedications,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถลงนามปิดการตรวจได้");
    }
  }

  function applyPreset(preset: NonNullable<typeof presets.data>[number]) {
    if (preset.diagnoses && preset.diagnoses.length > 0) {
      setDiagnoses(preset.diagnoses.map(d => ({ code: d.code ?? "", display: d.display })));
    }
    if (preset.medications && preset.medications.length > 0) {
      setMedications(preset.medications.map(m => ({
        medicationId: String(m.medicationId),
        dose: m.dose,
        frequency: m.frequency,
        duration: m.duration ?? "",
        quantityPrescribed: String(m.quantityPrescribed),
        instructions: m.instructions ?? "",
      })));
    }
    setNotice(`นำเข้าชุดคำสั่งด่วน "${preset.name}" เรียบร้อยแล้ว`);
  }

  async function handleSaveCurrentAsPreset(e: FormEvent) {
    e.preventDefault();
    if (!presetName.trim()) return;
    const cleanedDiagnoses = diagnoses
      .map(d => ({ code: d.code.trim() || undefined, display: d.display.trim() }))
      .filter(d => d.display.length > 0);
    const cleanedMedications = medications
      .filter(m => m.medicationId && m.dose.trim() && m.frequency.trim())
      .map(m => ({
        medicationId: Number(m.medicationId),
        dose: m.dose.trim(),
        frequency: m.frequency.trim(),
        duration: m.duration.trim() || undefined,
        quantityPrescribed: Number(m.quantityPrescribed) || 1,
        instructions: m.instructions.trim() || undefined,
      }));
    try {
      await createPreset.mutateAsync({
        name: presetName.trim(),
        description: presetDescription.trim() || undefined,
        diagnoses: cleanedDiagnoses,
        medications: cleanedMedications,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกชุดคำสั่งด่วนได้");
    }
  }

  if (consultation.isLoading) return <ConsoleState icon={Stethoscope} title="กำลังเปิดห้องตรวจ" detail="กำลังตรวจสิทธิ์และโหลดเฉพาะ encounter ที่ได้รับมอบหมายให้คุณ" />;
  if (consultation.error || !consultation.data) return <ConsoleState icon={ShieldAlert} title="ไม่สามารถเปิดห้องตรวจ" detail={consultation.error?.message ?? "ไม่พบรายการตรวจที่เข้าถึงได้"} actionLabel="กลับไปคิว" onAction={() => setLocation("/queue")} danger />;
  const item = consultation.data;
  const signed = item.note?.status === "SIGNED";

  const printableMedications = medications
    .filter(m => m.medicationId)
    .map((m, idx) => {
      const found = (medicationCatalog.data ?? []).find(c => c.id === Number(m.medicationId));
      return {
        id: idx + 1,
        medicationNameSnapshot: found ? [found.genericName, found.tradeName].filter(Boolean).join(" · ") : `ยา #${m.medicationId}`,
        strengthSnapshot: found?.strength ?? "",
        dose: m.dose,
        frequency: m.frequency,
        duration: m.duration || null,
        quantityPrescribed: Number(m.quantityPrescribed) || 1,
        instructions: m.instructions || null,
      };
    });

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 text-[#17312F]">
      <header className="rounded-[22px] border border-[#D5E3DD] bg-[#EAF4F0] px-5 py-5 sm:px-7">
        <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-[#0B6B67]">DOCTOR CONSOLE / ACTIVE ENCOUNTER</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">ห้องตรวจ</h1>
            <p className="mt-1 text-sm text-[#5C726C]">บันทึกข้อมูลจาก encounter ที่ระบบมอบหมายให้แพทย์ผู้ใช้งานเท่านั้น</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMedicalDocPrint(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#0B6B67] bg-white px-3.5 text-xs font-bold text-[#0B6B67] transition hover:bg-[#F0F8F5] active:scale-[0.98]"
            >
              <Printer size={15} /> พิมพ์ใบรับรองแพทย์ / ใบส่งตัว (A4)
            </button>
            {medications.length > 0 && (
              <button
                type="button"
                onClick={() => setShowLabelPrint(true)}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#17312F] bg-white px-3.5 text-xs font-bold text-[#17312F] transition hover:bg-[#F7F5EF] active:scale-[0.98]"
              >
                <Printer size={15} /> พิมพ์ฉลากยา (A4)
              </button>
            )}
            <button onClick={() => setLocation("/queue")} className="h-10 rounded-xl border border-[#A9CBC3] bg-white px-4 text-sm font-semibold text-[#0B6B67] transition hover:bg-[#F7FCFA] active:scale-[0.98]">
              กลับไปคิว
            </button>
          </div>
        </div>
      </header>

      {(error || notice) && <p role={error ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${error ? "border-[#E7C9C1] bg-[#FFF3F0] text-[#A13C2F]" : "border-[#CBE1D8] bg-[#F2F8F5] text-[#276451]"}`}>{error || notice}</p>}

      <section className="rounded-[20px] border border-[#D5E3DD] bg-white p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="font-mono text-[12px] font-bold tracking-wide text-[#0B6B67]">{item.hn}</p>
            <h2 className="mt-1 text-2xl font-semibold">{item.firstName} {item.lastName}</h2>
            <p className="mt-1 text-sm text-[#60756E]">
              วันเกิด {safeDate(item.dateOfBirth)} · {item.gender === "MALE" ? "ชาย" : item.gender === "FEMALE" ? "หญิง" : "ไม่ระบุ"}
            </p>
          </div>
          {item.allergySummary ? (
            <div role="alert" className="flex max-w-xl items-start gap-2.5 rounded-xl border-2 border-[#EF4444] bg-[#FEF2F2] px-4 py-3 text-sm">
              <ShieldAlert className="mt-0.5 shrink-0 text-[#EF4444]" size={18} />
              <div>
                <p className="font-bold uppercase tracking-wide text-[#7F1D1D]">แพ้ยา / ข้อควรระวัง</p>
                <p className="mt-1 font-semibold leading-5 text-[#7F1D1D]">{item.allergySummary}</p>
              </div>
            </div>
          ) : (
            <div className="max-w-xl rounded-xl border border-[#E1E8E3] bg-[#FAFCFA] px-4 py-3 text-sm">
              <p className="font-semibold text-[#5E746D]">แพ้ยา / ข้อควรระวัง</p>
              <p className="mt-1 leading-5 text-[#78897F]">ยังไม่ได้บันทึกข้อมูลแพ้ยา</p>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <DataBox label="อาการสำคัญ" value={item.chiefComplaint} />
          <DataBox label="ความดัน" value={item.bloodPressureSystolic && item.bloodPressureDiastolic ? `${item.bloodPressureSystolic}/${item.bloodPressureDiastolic} mmHg` : "-"} />
          <DataBox label="ชีพจร / SpO₂" value={`${metric(item.pulse, "bpm")} · ${metric(item.oxygenSaturation, "%")}`} />
          <DataBox label="อุณหภูมิ / น้ำหนัก" value={`${metric(item.temperatureCelsius, "°C")} · ${metric(item.weightKg, "kg")}`} />
        </div>

        {item.triageNote && (
          <p className="mt-4 rounded-xl bg-[#F3F7F5] px-4 py-3 text-sm leading-6 text-[#4B625B]">
            <span className="font-semibold">หมายเหตุ triage: </span>{item.triageNote}
          </p>
        )}
      </section>

      <div className="flex gap-2 border-b border-[#D5E3DD] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("consultation")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "consultation" ? "bg-[#0B6B67] text-white shadow-sm" : "bg-white text-[#556D66] hover:bg-[#F3F7F5]"
          }`}
        >
          <ClipboardPenLine size={16} /> บันทึกการตรวจปัจจุบัน
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
            activeTab === "history" ? "bg-[#0B6B67] text-white shadow-sm" : "bg-white text-[#556D66] hover:bg-[#F3F7F5]"
          }`}
        >
          <History size={16} />
          ประวัติการรับบริการ ({patientHistory.data?.visits.length ?? 0})
        </button>
      </div>

      {activeTab === "history" ? (
        <PatientHistoryView
          isLoading={patientHistory.isLoading}
          history={patientHistory.data?.visits ?? []}
          currentVisitId={visitId ?? 0}
        />
      ) : (
        <form onSubmit={submitDraft} className="grid gap-5 lg:grid-cols-[1.1fr_1.3fr]">
          <section className="rounded-[20px] border border-[#DCE5DF] bg-white p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#EAF4F0] text-[#0B6B67]">
                  <ClipboardList size={19} />
                </span>
                <div>
                  <h2 className="font-semibold">บันทึกเวชระเบียน (SOAP)</h2>
                  <p className="mt-0.5 text-xs text-[#71837E]">ฉบับร่างที่ {revision || 1} · บันทึกได้ต่อเนื่องก่อนลงนาม</p>
                </div>
              </div>
              <span className="rounded-full bg-[#F3F7F5] px-3 py-1 font-mono text-xs font-semibold text-[#0B6B67]">
                v{item.visitVersion}
              </span>
            </div>

            <div className="mt-5 grid gap-4">
              {([
                ["subjective", "S · Subjective", "อาการหรือข้อมูลที่ผู้รับบริการแจ้ง"],
                ["objective", "O · Objective", "ผลตรวจร่างกายหรือข้อสังเกต"],
                ["assessment", "A · Assessment", "การประเมินและการวิเคราะห์ของแพทย์"],
                ["plan", "P · Plan", "แผนการรักษา ยา คำแนะนำ และการนัดหมาย"],
              ] as const).map(([key, label, hint]) => (
                <label key={key} className="block">
                  <span className="mb-1.5 flex items-center justify-between gap-3 text-sm font-semibold text-[#344C46]">
                    <span>{label}</span>
                    <span className="text-xs font-normal text-[#85958F]">{hint}</span>
                  </span>
                  <textarea
                    disabled={signed}
                    value={note[key]}
                    onChange={event => setNote(current => ({ ...current, [key]: event.target.value }))}
                    rows={key === "plan" ? 4 : 3}
                    className="w-full rounded-xl border border-[#D7E1DB] bg-white px-3.5 py-2.5 text-sm outline-none transition placeholder:text-[#9AA9A3] disabled:cursor-not-allowed disabled:bg-[#F3F5F3] focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10"
                    placeholder={hint}
                  />
                </label>
              ))}
            </div>

            {!signed && (
              <button
                disabled={saveDraft.isPending}
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border border-[#0B6B67] bg-white px-4 text-sm font-semibold text-[#0B6B67] transition hover:bg-[#F0F8F5] disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]"
              >
                <Save size={16} />
                {saveDraft.isPending ? "กำลังบันทึก…" : "บันทึกฉบับร่าง"}
              </button>
            )}
          </section>

          <section className="rounded-[20px] border border-[#DCE5DF] bg-[#FDFCF9] p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF0E8] text-[#BA5939]">
                  <FileCheck2 size={19} />
                </span>
                <div>
                  <h2 className="font-semibold">การวินิจฉัยและคำสั่งยา</h2>
                  <p className="mt-0.5 text-xs leading-5 text-[#71837E]">ค้นหารหัสโรค ICD-10 และระบุคำสั่งยาก่อนลงนามส่งต่อ</p>
                </div>
              </div>
            </div>

            {!signed && (
              <div className="mt-4 rounded-xl border border-[#CDE3DB] bg-[#F0F8F5] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#D5E6E0] pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#0B6B67]">
                    <Sparkles size={15} />
                    <span>ชุดคำสั่งยา/หัตถการด่วน (Pre-sets)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSavePresetModal(true)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-[#0B6B67] hover:underline"
                  >
                    <BookmarkPlus size={14} /> บันทึกคำสั่งปัจจุบันเป็น Pre-set
                  </button>
                </div>
                <div className="mt-2.5">
                  {!presets.data?.length ? (
                    <p className="text-xs text-[#6B8079]">
                      ยังไม่มีชุดคำสั่งด่วน — เมื่อระบุการวินิจฉัยและยาแล้ว กด "บันทึกคำสั่งปัจจุบันเป็น Pre-set" เพื่อใช้ซ้ำในอนาคตได้ทันที
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {presets.data.map(preset => (
                        <div key={preset.id} className="inline-flex items-center rounded-lg border border-[#A9CBC3] bg-white text-xs shadow-sm">
                          <button
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 font-semibold text-[#17312F] hover:bg-[#EAF4F0] rounded-l-lg"
                            title={preset.description || undefined}
                          >
                            <span>⚡ {preset.name}</span>
                            <span className="text-[10px] text-[#71837E]">({preset.diagnoses.length} วินิจฉัย, {preset.medications.length} ยา)</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => deletePreset.mutate({ presetId: preset.id })}
                            disabled={deletePreset.isPending}
                            className="border-l border-[#A9CBC3] p-1.5 text-[#A44B3B] hover:bg-[#FFF0ED] rounded-r-lg"
                            title="ลบชุดคำสั่งนี้"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="mt-5 space-y-3">
              <h3 className="text-sm font-semibold text-[#344C46]">การวินิจฉัย (Diagnosis)</h3>
              {diagnoses.map((diagnosis, index) => (
                <DiagnosisInputRow
                  key={index}
                  index={index}
                  diagnosis={diagnosis}
                  disabled={signed}
                  onChange={(updated) =>
                    setDiagnoses(current => current.map((item, row) => (row === index ? updated : item)))
                  }
                  onRemove={() =>
                    setDiagnoses(current => current.filter((_, row) => row !== index))
                  }
                  canRemove={diagnoses.length > 1 && !signed}
                />
              ))}
            </div>

            {!signed && (
              <button
                type="button"
                onClick={() => setDiagnoses(current => [...current, { code: "", display: "" }])}
                className="mt-3 text-sm font-semibold text-[#0B6B67] hover:underline"
              >
                + เพิ่มการวินิจฉัย
              </button>
            )}

            {!signed && (
              <MedicationOrders catalog={medicationCatalog.data ?? []} medications={medications} onChange={setMedications} />
            )}

            {signed ? (
              <div className="mt-5 rounded-xl border border-[#CBE1D8] bg-[#F2F8F5] p-4 text-sm text-[#276451]">
                <CheckCircle2 className="mb-2" size={18} />
                <p className="font-semibold">ลงนามแล้ว</p>
                <p className="mt-1 leading-5">บันทึกฉบับนี้ถูกปิดเพื่อป้องกันการแก้ไข และได้ส่งต่อระบบการเงิน โปรดออกบิลและรับชำระก่อนปิดงาน</p>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-[#F0D9C9] bg-[#FFF8F3] p-4">
                <div className="flex gap-2 text-sm text-[#8C462B]">
                  <ShieldAlert size={17} className="mt-0.5 shrink-0" />
                  <p>
                    {medications.length
                      ? "การลงนามจะส่งรายการยาและ encounter ไปยัง Cashier เพื่อจ่ายยา เพิ่มค่าบริการ ออกบิล และรับชำระ"
                      : "การลงนามจะส่ง encounter ไปยัง Cashier เพื่อเพิ่มค่าบริการ (ถ้ามี) ออกบิล และรับชำระก่อนปิดงาน"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={signEncounter.isPending}
                  onClick={() => void submitSignature()}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#17312F] px-4 text-sm font-semibold text-white transition hover:bg-[#244942] disabled:cursor-not-allowed disabled:opacity-55 active:scale-[0.98]"
                >
                  <FileCheck2 size={16} />
                  {signEncounter.isPending ? "กำลังลงนาม…" : "ลงนามและส่งต่อการเงิน"}
                </button>
              </div>
            )}
          </section>
        </form>
      )}

      {showSavePresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-[#E1E8E3] pb-3">
              <div className="flex items-center gap-2">
                <BookmarkPlus className="text-[#0B6B67]" size={20} />
                <h3 className="font-bold text-[#17312F]">บันทึกชุดคำสั่งด่วน (Pre-set)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSavePresetModal(false)}
                className="text-[#71837E] hover:text-[#17312F]"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveCurrentAsPreset} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#526861] mb-1">
                  ชื่อชุดคำสั่งด่วน *
                </label>
                <input
                  required
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  placeholder="เช่น ชุดไข้หวัด/URI, ชุดแผลสด, ชุดปวดกล้ามเนื้อ"
                  className="h-10 w-full rounded-xl border border-[#BBD8CE] px-3 text-sm outline-none focus:border-[#0B6B67]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#526861] mb-1">
                  คำอธิบายเพิ่มเติม (ถ้ามี)
                </label>
                <input
                  value={presetDescription}
                  onChange={e => setPresetDescription(e.target.value)}
                  placeholder="เช่น สำหรับผู้ป่วยหวัด คัดจมูก มีไข้ต่ำๆ"
                  className="h-10 w-full rounded-xl border border-[#BBD8CE] px-3 text-sm outline-none focus:border-[#0B6B67]"
                />
              </div>
              <div className="rounded-xl bg-[#F7FCFA] p-3 text-xs text-[#526861] space-y-1">
                <p><strong>การวินิจฉัยที่จะบันทึก:</strong> {diagnoses.filter(d => d.display.trim()).length} รายการ</p>
                <p><strong>รายการยาที่จะบันทึก:</strong> {medications.filter(m => m.medicationId).length} รายการ</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSavePresetModal(false)}
                  className="rounded-xl border border-[#D7E1DB] px-4 py-2 text-xs font-semibold text-[#526861] hover:bg-[#F3F5F3]"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={createPreset.isPending}
                  className="rounded-xl bg-[#0B6B67] px-4 py-2 text-xs font-semibold text-white hover:bg-[#095956] disabled:opacity-50"
                >
                  {createPreset.isPending ? "กำลังบันทึก…" : "บันทึก Pre-set"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showMedicalDocPrint && consultation.data && (
        <MedicalCertificatePrint
          doctor={{
            name: user?.displayName || "นายแพทย์ผู้ตรวจรักษา",
            licenseNumber: "ว. 12345",
          }}
          patient={{
            hn: consultation.data.hn,
            firstName: consultation.data.firstName,
            lastName: consultation.data.lastName,
            gender: consultation.data.gender,
            dateOfBirth: consultation.data.dateOfBirth,
            allergySummary: consultation.data.allergySummary,
          }}
          encounter={{
            visitDate: new Date().toISOString().slice(0, 10),
            chiefComplaint: consultation.data.chiefComplaint,
            subjective: note.subjective,
            objective: note.objective,
            assessment: note.assessment,
            plan: note.plan,
            signedAt: consultation.data.note?.signedAt,
            bloodPressureSystolic: consultation.data.bloodPressureSystolic,
            bloodPressureDiastolic: consultation.data.bloodPressureDiastolic,
            pulse: consultation.data.pulse,
            temperatureCelsius: consultation.data.temperatureCelsius,
            weightKg: consultation.data.weightKg,
            heightCm: consultation.data.heightCm,
          }}
          diagnoses={diagnoses.filter(d => d.display.trim().length > 0)}
          medications={printableMedications}
          onClose={() => setShowMedicalDocPrint(false)}
        />
      )}

      {showLabelPrint && consultation.data && (
        <MedicationLabelPrint
          patient={{
            hn: consultation.data.hn,
            firstName: consultation.data.firstName,
            lastName: consultation.data.lastName,
            allergySummary: consultation.data.allergySummary,
          }}
          visitDate={new Date().toISOString().slice(0, 10)}
          items={printableMedications}
          onClose={() => setShowLabelPrint(false)}
        />
      )}
    </div>
  );
}

function DiagnosisInputRow({
  index,
  diagnosis,
  disabled,
  onChange,
  onRemove,
  canRemove,
}: {
  index: number;
  diagnosis: DiagnosisDraft;
  disabled: boolean;
  onChange: (updated: DiagnosisDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchResults = searchIcd10(searchTerm || diagnosis.display, 8);

  return (
    <div className="relative rounded-xl border border-[#E1E8E3] bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_100px]">
        <div>
          <label className="mb-1 block text-xs font-semibold text-[#526861]">
            คำวินิจฉัย (พิมพ์เพื่อค้นหา ICD-10)
          </label>
          <input
            disabled={disabled}
            required
            value={diagnosis.display}
            onFocus={() => setShowDropdown(true)}
            onChange={event => {
              const val = event.target.value;
              setSearchTerm(val);
              setShowDropdown(true);
              onChange({ ...diagnosis, display: val });
            }}
            placeholder="เช่น หวัด, ความดัน, GERD, หรือ J00"
            className="h-10 w-full rounded-lg border border-[#D7E1DB] px-3 text-sm outline-none disabled:bg-[#F3F5F3] focus:border-[#0B6B67]"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-[#526861]">รหัส ICD-10</label>
          <input
            disabled={disabled}
            value={diagnosis.code}
            onChange={event => onChange({ ...diagnosis, code: event.target.value })}
            placeholder="เช่น J00"
            className="h-10 w-full rounded-lg border border-[#D7E1DB] px-3 text-sm uppercase outline-none disabled:bg-[#F3F5F3] focus:border-[#0B6B67]"
          />
        </div>
      </div>

      {/* ICD-10 Search Autocomplete Dropdown */}
      {!disabled && showDropdown && searchResults.length > 0 && (
        <div className="absolute left-3 right-3 top-[74px] z-20 max-h-56 overflow-y-auto rounded-xl border border-[#A5C8BE] bg-white p-1.5 shadow-xl">
          <div className="flex items-center justify-between border-b border-[#EAF2EE] px-2 py-1 text-[11px] font-semibold text-[#0B6B67]">
            <span>ผลการค้นหารหัสโรค ICD-10</span>
            <button
              type="button"
              onClick={() => setShowDropdown(false)}
              className="text-xs text-[#7B8F89] hover:text-[#17312F]"
            >
              ปิด
            </button>
          </div>
          {searchResults.map(item => (
            <button
              type="button"
              key={item.code}
              onClick={() => {
                onChange({ code: item.code, display: `${item.nameTh} (${item.nameEn})` });
                setShowDropdown(false);
              }}
              className="flex w-full items-start justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition hover:bg-[#EDF7F3]"
            >
              <div>
                <p className="font-semibold text-[#17312F]">{item.nameTh}</p>
                <p className="text-[11px] text-[#69807A]">{item.nameEn}</p>
              </div>
              <span className="rounded bg-[#EAF4F0] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#0B6B67]">
                {item.code}
              </span>
            </button>
          ))}
        </div>
      )}

      {canRemove && (
        <button type="button" onClick={onRemove} className="mt-2 text-xs font-semibold text-[#A44B3B] hover:underline">
          ลบรายการนี้
        </button>
      )}
    </div>
  );
}

function PatientHistoryView({
  isLoading,
  history,
  currentVisitId,
}: {
  isLoading: boolean;
  history: Array<{
    visitId: number;
    visitDate: string;
    chiefComplaint: string;
    status: string;
    createdAt: Date;
    triage: {
      bloodPressureSystolic?: number | null;
      bloodPressureDiastolic?: number | null;
      pulse?: number | null;
      temperatureCelsius?: string | null;
      oxygenSaturation?: number | null;
      weightKg?: string | null;
      heightCm?: string | null;
      triageNote?: string | null;
      urgency: string;
    } | null;
    clinicalNote: {
      subjective?: string | null;
      objective?: string | null;
      assessment?: string | null;
      plan?: string | null;
      status: string;
      signedAt?: Date | null;
    } | null;
    diagnoses: Array<{ code?: string | null; display: string; rank: number }>;
    prescriptions: Array<{
      medicationNameSnapshot: string;
      dosageFormSnapshot: string;
      strengthSnapshot: string;
      dose: string;
      frequency: string;
      duration?: string | null;
      quantityPrescribed: number;
      instructions?: string | null;
    }>;
  }>;
  currentVisitId: number | null;
}) {
  if (isLoading) {
    return (
      <div className="rounded-[20px] border border-[#DCE5DF] bg-white p-8 text-center text-sm text-[#69807A]">
        กำลังโหลดประวัติการรับบริการ…
      </div>
    );
  }

  if (!history.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-[#D4E1DA] bg-white p-8 text-center text-sm text-[#69807A]">
        <ClipboardList className="mx-auto mb-2 text-[#0B6B67]" size={24} />
        ไม่พบประวัติการรับบริการเดิมของผู้รับบริการท่านนี้
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[#5F7770]">
        แสดงประวัติการรับบริการย้อนหลังทั้งหมด {history.length} ครั้ง (เรียงจากล่าสุด)
      </p>

      <div className="space-y-4">
        {history.map(item => {
          const isCurrent = item.visitId === currentVisitId;
          return (
            <div
              key={item.visitId}
              className={`rounded-[20px] border bg-white p-5 shadow-sm transition ${
                isCurrent ? "border-2 border-[#0B6B67] bg-[#F7FCFA]" : "border-[#DCE5DF]"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EAF0EC] pb-3">
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#EAF4F0] text-[#0B6B67]">
                    <Calendar size={16} />
                  </span>
                  <div>
                    <p className="font-semibold text-[#17312F]">
                      วันที่ {safeDate(item.visitDate)} {isCurrent ? " (ครั้งปัจจุบัน)" : ""}
                    </p>
                    <p className="text-xs text-[#6B807A]">
                      สถานะ: {item.status} · บันทึกตรวจ: {item.clinicalNote?.status === "SIGNED" ? "ลงนามแล้ว" : "ฉบับร่าง"}
                    </p>
                  </div>
                </div>

                {item.diagnoses.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {item.diagnoses.map((diag, i) => (
                      <span key={i} className="rounded-full bg-[#DDF0EA] px-2.5 py-0.5 text-xs font-semibold text-[#0B6B67]">
                        {diag.code ? `[${diag.code}] ` : ""}{diag.display}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Visit Details */}
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-[#526861]">อาการสำคัญ</p>
                  <p className="mt-0.5 text-sm text-[#17312F]">{item.chiefComplaint || "-"}</p>

                  {item.triage && (
                    <div className="mt-2 text-xs text-[#526861]">
                      <span className="font-semibold">สัญญาณชีพ: </span>
                      {item.triage.bloodPressureSystolic && item.triage.bloodPressureDiastolic ? `BP ${item.triage.bloodPressureSystolic}/${item.triage.bloodPressureDiastolic} mmHg ` : ""}
                      {item.triage.pulse ? `· PR ${item.triage.pulse} bpm ` : ""}
                      {item.triage.temperatureCelsius ? `· T ${item.triage.temperatureCelsius}°C ` : ""}
                      {item.triage.weightKg ? `· Wt ${item.triage.weightKg} kg` : ""}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-[#526861]">บันทึกการรักษา (SOAP)</p>
                  {item.clinicalNote ? (
                    <div className="mt-1 space-y-1 text-xs text-[#2A433E]">
                      {item.clinicalNote.subjective && <p><span className="font-semibold">S:</span> {item.clinicalNote.subjective}</p>}
                      {item.clinicalNote.objective && <p><span className="font-semibold">O:</span> {item.clinicalNote.objective}</p>}
                      {item.clinicalNote.assessment && <p><span className="font-semibold">A:</span> {item.clinicalNote.assessment}</p>}
                      {item.clinicalNote.plan && <p><span className="font-semibold">P:</span> {item.clinicalNote.plan}</p>}
                    </div>
                  ) : (
                    <p className="mt-0.5 text-xs text-[#899B95]">ไม่มีบันทึก SOAP</p>
                  )}
                </div>
              </div>

              {/* Prescriptions */}
              {item.prescriptions && item.prescriptions.length > 0 && (
                <div className="mt-4 border-t border-[#EAF0EC] pt-3">
                  <p className="text-xs font-semibold text-[#526861]">ยาที่ได้รับ ({item.prescriptions.length} รายการ):</p>
                  <ul className="mt-1.5 space-y-1">
                    {item.prescriptions.map((rx, rxIdx) => (
                      <li key={rxIdx} className="text-xs text-[#17312F]">
                        • <span className="font-semibold">{rx.medicationNameSnapshot} {rx.strengthSnapshot}</span>: {rx.dose} {rx.frequency} ({rx.quantityPrescribed} {rx.dosageFormSnapshot}) {rx.instructions ? `[${rx.instructions}]` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SelectFromQueue({ onGoToQueue }: { onGoToQueue: () => void }) {
  return <ConsoleState icon={HeartPulse} title="เลือก encounter จากคิว" detail="เปิดคิววันนี้ แล้วเลือกเฉพาะรายการที่แพทย์เรียกและได้รับมอบหมายให้ตนเอง" actionLabel="เปิดคิววันนี้" onAction={onGoToQueue} />;
}

function ConsoleState({ icon: Icon, title, detail, actionLabel, onAction, danger }: { icon: typeof Stethoscope; title: string; detail: string; actionLabel?: string; onAction?: () => void; danger?: boolean }) {
  return (
    <section className={`mx-auto grid min-h-[480px] max-w-2xl place-items-center rounded-[22px] border px-6 text-center ${danger ? "border-[#E7D4CE] bg-[#FFF9F7]" : "border-[#D5E3DD] bg-[#F7FCFA]"}`}>
      <div>
        <Icon className={`mx-auto ${danger ? "text-[#A44B3B]" : "text-[#0B6B67]"}`} size={30} />
        <h1 className="mt-4 text-xl font-semibold">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#60756E]">{detail}</p>
        {actionLabel && onAction && (
          <button onClick={onAction} className="mt-5 h-10 rounded-xl bg-[#0B6B67] px-4 text-sm font-semibold text-white transition hover:bg-[#095B58] active:scale-[0.98]">
            {actionLabel}
          </button>
        )}
      </div>
    </section>
  );
}

function DataBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#E1E8E3] bg-[#FDFEFD] px-3.5 py-3">
      <p className="text-[11px] font-semibold tracking-wide text-[#75877F]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[#334B45]">{value}</p>
    </div>
  );
}

function MedicationOrders({
  catalog,
  medications,
  onChange,
}: {
  catalog: Array<{ id: number; code: string; genericName: string; dosageForm: string; strength: string }>;
  medications: MedicationDraft[];
  onChange: (next: MedicationDraft[]) => void;
}) {
  return (
    <section className="mt-5 border-t border-[#E1E8E3] pt-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Pill className="text-[#0B6B67]" size={18} />
          <div>
            <h3 className="font-semibold">คำสั่งยา</h3>
            <p className="text-xs text-[#71837E]">เลือกเฉพาะยาที่ผู้ดูแลระบบบันทึกและเปิดใช้งานแล้ว</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange([...medications, emptyMedication])}
          className="inline-flex items-center gap-1 text-sm font-semibold text-[#0B6B67]"
        >
          <Plus size={16} />เพิ่มยา
        </button>
      </div>

      {!medications.length ? (
        <p className="mt-3 rounded-xl bg-[#F3F7F5] px-3 py-3 text-xs text-[#60756E]">
          ไม่มีคำสั่งยา ระบบจะยังส่ง encounter ไป Cashier เพื่อออกบิลและรับชำระก่อนปิดงาน
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {medications.map((medication, index) => (
            <div key={index} className="rounded-xl border border-[#E1E8E3] bg-white p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-[#526861]">ยา</span>
                  <select
                    value={medication.medicationId}
                    onChange={event =>
                      onChange(medications.map((item, row) => (row === index ? { ...item, medicationId: event.target.value } : item)))
                    }
                    className="h-10 w-full rounded-lg border border-[#D7E1DB] bg-white px-3 text-sm"
                  >
                    <option value="">เลือกยา</option>
                    {catalog.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.code} · {item.genericName} {item.strength}
                      </option>
                    ))}
                  </select>
                </label>
                {([
                  ["dose", "ขนาดยา", "เช่น 1 เม็ด"],
                  ["frequency", "ความถี่", "เช่น วันละ 2 ครั้ง"],
                  ["duration", "ระยะเวลา", "ถ้ามี"],
                  ["quantityPrescribed", "จำนวน", "จำนวนเต็ม"],
                ] as const).map(([field, label, placeholder]) => (
                  <label key={field}>
                    <span className="mb-1 block text-xs font-semibold text-[#526861]">{label}</span>
                    <input
                      inputMode={field === "quantityPrescribed" ? "numeric" : undefined}
                      value={medication[field]}
                      placeholder={placeholder}
                      onChange={event =>
                        onChange(medications.map((item, row) => (row === index ? { ...item, [field]: event.target.value } : item)))
                      }
                      className="h-10 w-full rounded-lg border border-[#D7E1DB] px-3 text-sm"
                    />
                  </label>
                ))}
                <label className="sm:col-span-2">
                  <span className="mb-1 block text-xs font-semibold text-[#526861]">คำแนะนำ (ถ้ามี)</span>
                  <input
                    value={medication.instructions}
                    onChange={event =>
                      onChange(medications.map((item, row) => (row === index ? { ...item, instructions: event.target.value } : item)))
                    }
                    className="h-10 w-full rounded-lg border border-[#D7E1DB] px-3 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                onClick={() => onChange(medications.filter((_, row) => row !== index))}
                className="mt-2 text-xs font-semibold text-[#A44B3B]"
              >
                ลบคำสั่งยานี้
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

