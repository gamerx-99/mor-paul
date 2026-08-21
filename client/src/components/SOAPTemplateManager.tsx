import { BookmarkPlus, ChevronDown, ChevronUp, Search, Trash2, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { trpc } from "@/lib/trpc";

type NoteFields = { subjective: string; objective: string; assessment: string; plan: string };

type ServiceType = "general" | "followup" | "acute" | "chronic" | "wellness" | "other";

const SERVICE_LABELS: Record<ServiceType, string> = {
  general: "ทั่วไป",
  followup: "ติดตาม",
  acute: "เฉียบพลัน",
  chronic: "เรื้อรัง",
  wellness: "สุขภาพ",
  other: "อื่นๆ",
};

interface Props {
  visitId: number;
  onApplyTemplate: (template: { subjectiveTemplate: string; objectiveTemplate: string; assessmentTemplate: string; planTemplate: string }) => void;
  currentNote: NoteFields;
}

export default function SOAPTemplateManager({ visitId, onApplyTemplate, currentNote }: Props) {
  const utils = trpc.useUtils();
  const [showForm, setShowForm] = useState(false);
  const [filterService, setFilterService] = useState<ServiceType | "">("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data: templates, isLoading } = trpc.doctorConsole.listSoapTemplates.useQuery(
    filterService ? { serviceType: filterService } : undefined,
  );

  const createMutation = trpc.doctorConsole.createSoapTemplate.useMutation({
    onSuccess: () => {
      setShowForm(false);
      void utils.doctorConsole.listSoapTemplates.invalidate();
    },
  });

  const deactivateMutation = trpc.doctorConsole.deactivateSoapTemplate.useMutation({
    onSuccess: () => {
      void utils.doctorConsole.listSoapTemplates.invalidate();
    },
  });

  const filtered = templates?.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || SERVICE_LABELS[t.serviceType as ServiceType]?.includes(search)) ?? [];

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const serviceType = form.get("serviceType") as ServiceType;
    const name = String(form.get("name") ?? "").trim();
    const subjectiveTemplate = String(form.get("subjectiveTemplate") ?? "").trim();
    const objectiveTemplate = String(form.get("objectiveTemplate") ?? "").trim();
    const assessmentTemplate = String(form.get("assessmentTemplate") ?? "").trim();
    const planTemplate = String(form.get("planTemplate") ?? "").trim();
    await createMutation.mutateAsync({ serviceType, name, subjectiveTemplate, objectiveTemplate, assessmentTemplate, planTemplate });
  }

  async function handleDeactivate(id: number) {
    if (!confirm("ปิดการใช้งานเทมเพลตนี้?")) return;
    await deactivateMutation.mutate({ id });
  }

  if (isLoading) return <div className="rounded-xl border border-[#D5E3DD] bg-white p-4 text-sm text-[#556D66]">กำลังโหลดเทมเพลต...</div>;

  return (
    <div className="rounded-[20px] border border-[#DCE5DF] bg-[#FDFCF9] p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFF0E8] text-[#BA5939]">
            <BookmarkPlus size={19} />
          </span>
          <div>
            <h2 className="font-semibold">เทมเพลต SOAP ตามประเภทบริการ</h2>
            <p className="mt-0.5 text-xs leading-5 text-[#71837E]">เลือกเทมเพลตเพื่อเติม S · O · A · P ให้เร็ว</p>
          </div>
        </div>
        <button type="button" onClick={() => setShowForm(v => !v)} className="inline-flex items-center gap-1 text-xs font-bold text-[#0B6B67] hover:underline">
          {showForm ? <><X size={14} /> ยกเลิก</> : <><BookmarkPlus size={14} /> สร้างเทมเพลตใหม่</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submitCreate} className="mt-4 rounded-xl border border-[#CDE3DB] bg-white p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-[#344C46]">
              ประเภทบริการ
              <select name="serviceType" required className="mt-1 w-full rounded-lg border border-[#D7E1DB] bg-white px-3 py-2 text-sm">
                {(Object.keys(SERVICE_LABELS) as ServiceType[]).map(k => (
                  <option key={k} value={k}>{SERVICE_LABELS[k]}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-[#344C46]">
              ชื่อเทมเพลต
              <input name="name" required minLength={2} maxLength={120} className="mt-1 w-full rounded-lg border border-[#D7E1DB] bg-white px-3 py-2 text-sm" />
            </label>
          </div>
          <label className="block text-xs font-semibold text-[#344C46]">
            Subjective (S)
            <textarea name="subjectiveTemplate" required minLength={1} maxLength={4000} rows={2} className="mt-1 w-full rounded-lg border border-[#D7E1DB] bg-white px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-semibold text-[#344C46]">
            Objective (O)
            <textarea name="objectiveTemplate" required minLength={1} maxLength={4000} rows={2} className="mt-1 w-full rounded-lg border border-[#D7E1DB] bg-white px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-semibold text-[#344C46]">
            Assessment (A)
            <textarea name="assessmentTemplate" required minLength={1} maxLength={4000} rows={2} className="mt-1 w-full rounded-lg border border-[#D7E1DB] bg-white px-3 py-2 text-sm" />
          </label>
          <label className="block text-xs font-semibold text-[#344C46]">
            Plan (P)
            <textarea name="planTemplate" required minLength={1} maxLength={4000} rows={2} className="mt-1 w-full rounded-lg border border-[#D7E1DB] bg-white px-3 py-2 text-sm" />
          </label>
          <button type="submit" disabled={createMutation.isPending} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0B6B67] px-4 text-sm font-semibold text-white transition hover:bg-[#0E827E] disabled:cursor-not-allowed disabled:opacity-55">
            {createMutation.isPending ? "กำลังบันทึก..." : "บันทึกเทมเพลต"}
          </button>
        </form>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-2.5 text-[#71837E]" size={15} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหาเทมเพลต..." className="w-full rounded-xl border border-[#D7E1DB] bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-[#0B6B67] focus:ring-4 focus:ring-[#0B6B67]/10" />
        </div>
        <select value={filterService} onChange={e => setFilterService(e.target.value as ServiceType | "")} className="rounded-xl border border-[#D7E1DB] bg-white px-3 py-2 text-sm">
          <option value="">ทุกประเภทบริการ</option>
          {(Object.keys(SERVICE_LABELS) as ServiceType[]).map(k => (
            <option key={k} value={k}>{SERVICE_LABELS[k]}</option>
          ))}
        </select>
      </div>

      <div className="mt-3 space-y-2">
        {!filtered.length ? <p className="text-xs text-[#6B8079]">ยังไม่มีเทมเพลตที่ตรงกับเงื่อนไข</p> : null}
        {filtered.map(template => {
          const isOpen = expanded === String(template.id);
          return (
            <div key={template.id} className="rounded-xl border border-[#D5E3DD] bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <button type="button" onClick={() => setExpanded(isOpen ? null : String(template.id))} className="flex-1 text-left">
                  <p className="text-sm font-semibold text-[#17312F]">{template.name}</p>
                  <p className="text-xs text-[#6B8079]">{SERVICE_LABELS[template.serviceType as ServiceType] ?? template.serviceType}</p>
                </button>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => onApplyTemplate({ subjectiveTemplate: template.subjectiveTemplate, objectiveTemplate: template.objectiveTemplate, assessmentTemplate: template.assessmentTemplate, planTemplate: template.planTemplate })} className="rounded-lg border border-[#0B6B67] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0B6B67] hover:bg-[#F0F8F5]">
                    ใช้เทมเพลตนี้
                  </button>
                  <button type="button" onClick={() => handleDeactivate(template.id)} disabled={deactivateMutation.isPending} className="rounded-lg border border-[#E7C9C1] bg-white p-1.5 text-[#A44B3B] hover:bg-[#FFF0ED]">
                    <Trash2 size={12} />
                  </button>
                  <button type="button" onClick={() => setExpanded(isOpen ? null : String(template.id))} className="rounded-lg border border-[#D5E3DD] bg-white p-1.5 text-[#556D66]">
                    {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>
              {isOpen && (
                <div className="mt-2 grid gap-2 text-xs text-[#4B625B]">
                  <div><span className="font-semibold text-[#71837E]">S:</span> {template.subjectiveTemplate}</div>
                  <div><span className="font-semibold text-[#71837E]">O:</span> {template.objectiveTemplate}</div>
                  <div><span className="font-semibold text-[#71837E]">A:</span> {template.assessmentTemplate}</div>
                  <div><span className="font-semibold text-[#71837E]">P:</span> {template.planTemplate}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
