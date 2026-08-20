import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { AccessDenied } from "@/pages/FrontDesk";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, FileSpreadsheet, Filter, RefreshCw, Search, Shield, ShieldAlert, XCircle } from "lucide-react";
import { useState } from "react";

type RoleFilter = "SYSTEM_ADMIN" | "DOCTOR" | "ASSISTANT" | "";
type OutcomeFilter = "ALLOWED" | "DENIED" | "FAILED" | "";

function formatDateTime(dateVal: string | Date) {
  const d = new Date(dateVal);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("th-TH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function roleBadge(role: string) {
  switch (role) {
    case "SYSTEM_ADMIN":
      return <span className="rounded-full bg-[#EDE9FE] px-2.5 py-0.5 text-xs font-semibold text-[#6D28D9]">ผู้ดูแลระบบ</span>;
    case "DOCTOR":
      return <span className="rounded-full bg-[#E0F2FE] px-2.5 py-0.5 text-xs font-semibold text-[#0369A1]">แพทย์</span>;
    case "ASSISTANT":
      return <span className="rounded-full bg-[#EAF4F0] px-2.5 py-0.5 text-xs font-semibold text-[#0B6B67]">ผู้ช่วย</span>;
    default:
      return <span className="rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-semibold text-[#4B5563]">{role}</span>;
  }
}

function outcomeBadge(outcome: string) {
  switch (outcome) {
    case "ALLOWED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#DEF7EC] px-2 py-0.5 text-xs font-semibold text-[#03543F]">
          <CheckCircle2 size={12} /> สำเร็จ
        </span>
      );
    case "DENIED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FDE8E8] px-2 py-0.5 text-xs font-semibold text-[#9B1C1C]">
          <XCircle size={12} /> ปฏิเสธ
        </span>
      );
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-[#FEF08A] px-2 py-0.5 text-xs font-semibold text-[#713F12]">
          <ShieldAlert size={12} /> ผิดพลาด
        </span>
      );
    default:
      return <span>{outcome}</span>;
  }
}

export default function AuditLogs() {
  const { user } = useAuth();
  const [page, setPage] = useState(0);
  const limit = 30;

  const [actionSearch, setActionSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const canView = user?.role === "SYSTEM_ADMIN";

  const queryInput = {
    limit,
    offset: page * limit,
    action: actionSearch.trim() || undefined,
    actorRole: roleFilter || undefined,
    outcome: outcomeFilter || undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const auditQuery = trpc.reports.listAuditLogs.useQuery(queryInput, {
    enabled: canView,
  });

  if (!canView) {
    return (
      <AccessDenied
        title="บันทึกกิจกรรมความปลอดภัย (Audit Logs)"
        detail="หน้านี้สงวนสิทธิ์สำหรับผู้ดูแลระบบ (SYSTEM_ADMIN) เท่านั้น เพื่อตรวจสอบความปลอดภัยตามหลัก Zero Patient Data Access"
      />
    );
  }

  const items = auditQuery.data?.items ?? [];
  const totalCount = auditQuery.data?.totalCount ?? 0;
  const totalPages = Math.ceil(totalCount / limit);

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 text-[#17312F]">
      <header className="rounded-[22px] border border-[#D5E3DD] bg-[#EAF4F0] px-5 py-5 sm:px-7">
        <p className="font-mono text-[11px] font-bold tracking-[0.14em] text-[#0B6B67]">SECURITY / AUDIT TRAILS</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">บันทึกกิจกรรมความปลอดภัย (Audit Logs)</h1>
            <p className="mt-1 text-sm text-[#5C726C]">
              ตรวจสอบกิจกรรมการเข้าใช้งานและการทำรายการของผู้ใช้ทุกคน โดยแสดงเฉพาะ Metadata ความปลอดภัย (Zero-PHI)
            </p>
          </div>
          <button
            type="button"
            onClick={() => void auditQuery.refetch()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#A9CBC3] bg-white px-4 text-sm font-semibold text-[#0B6B67] transition hover:bg-[#F7FCFA] active:scale-[0.98]"
          >
            <RefreshCw size={15} className={auditQuery.isFetching ? "animate-spin" : ""} />
            รีเฟรชข้อมูล
          </button>
        </div>
      </header>

      {/* Filter Section */}
      <section className="rounded-[20px] border border-[#DCE5DF] bg-[#FDFCF9] p-5 shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#344C46]">
          <Filter size={16} className="text-[#0B6B67]" />
          <span>ตัวกรองการค้นหา</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-[#526861]">กิจกรรม (Action)</label>
            <div className="relative">
              <input
                value={actionSearch}
                onChange={event => {
                  setActionSearch(event.target.value);
                  setPage(0);
                }}
                placeholder="เช่น AUTH_, PATIENT_, STAFF_"
                className="h-10 w-full rounded-xl border border-[#D7E1DB] bg-white px-3 text-xs outline-none focus:border-[#0B6B67] focus:ring-2 focus:ring-[#0B6B67]/10"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#526861]">บทบาทผู้กระทำ (Role)</label>
            <select
              value={roleFilter}
              onChange={event => {
                setRoleFilter(event.target.value as RoleFilter);
                setPage(0);
              }}
              className="h-10 w-full rounded-xl border border-[#D7E1DB] bg-white px-3 text-xs outline-none focus:border-[#0B6B67]"
            >
              <option value="">ทุกบทบาท</option>
              <option value="SYSTEM_ADMIN">ผู้ดูแลระบบ (SYSTEM_ADMIN)</option>
              <option value="DOCTOR">แพทย์ (DOCTOR)</option>
              <option value="ASSISTANT">ผู้ช่วยคลินิก (ASSISTANT)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#526861]">ผลลัพธ์ (Outcome)</label>
            <select
              value={outcomeFilter}
              onChange={event => {
                setOutcomeFilter(event.target.value as OutcomeFilter);
                setPage(0);
              }}
              className="h-10 w-full rounded-xl border border-[#D7E1DB] bg-white px-3 text-xs outline-none focus:border-[#0B6B67]"
            >
              <option value="">ทั้งหมด</option>
              <option value="ALLOWED">ALLOWED (สำเร็จ)</option>
              <option value="DENIED">DENIED (ปฏิเสธ)</option>
              <option value="FAILED">FAILED (ผิดพลาด)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#526861]">ตั้งแต่วันที่</label>
            <input
              type="date"
              value={startDate}
              onChange={event => {
                setStartDate(event.target.value);
                setPage(0);
              }}
              className="h-10 w-full rounded-xl border border-[#D7E1DB] bg-white px-3 text-xs outline-none focus:border-[#0B6B67]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-[#526861]">ถึงวันที่</label>
            <input
              type="date"
              value={endDate}
              onChange={event => {
                setEndDate(event.target.value);
                setPage(0);
              }}
              className="h-10 w-full rounded-xl border border-[#D7E1DB] bg-white px-3 text-xs outline-none focus:border-[#0B6B67]"
            />
          </div>
        </div>

        {(actionSearch || roleFilter || outcomeFilter || startDate || endDate) && (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setActionSearch("");
                setRoleFilter("");
                setOutcomeFilter("");
                setStartDate("");
                setEndDate("");
                setPage(0);
              }}
              className="text-xs font-semibold text-[#0B6B67] hover:underline"
            >
              ล้างตัวกรองทั้งหมด
            </button>
          </div>
        )}
      </section>

      {/* Audit Log Table */}
      <section className="overflow-hidden rounded-[20px] border border-[#D5E3DD] bg-white shadow-[0_10px_30px_rgba(23,49,47,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EAF0EC] px-5 py-4">
          <p className="text-sm font-semibold text-[#17312F]">
            รายการบันทึกกิจกรรมทั้งหมด ({totalCount.toLocaleString()} รายการ)
          </p>
          <p className="text-xs text-[#71837E]">
            หน้า {page + 1} จาก {Math.max(1, totalPages)}
          </p>
        </div>

        {auditQuery.isLoading ? (
          <div className="p-12 text-center text-sm text-[#71837E]">กำลังโหลด Audit Logs…</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#71837E]">ไม่พบบันทึกกิจกรรมตามเงื่อนไขที่ระบุ</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#EAF0EC] bg-[#F9FBFA] text-[#556E67]">
                <tr>
                  <th className="px-4 py-3 font-semibold">วันเวลา</th>
                  <th className="px-4 py-3 font-semibold">กิจกรรม (Action)</th>
                  <th className="px-4 py-3 font-semibold">ผู้กระทำ</th>
                  <th className="px-4 py-3 font-semibold">เป้าหมาย (Entity)</th>
                  <th className="px-4 py-3 font-semibold">ผลลัพธ์</th>
                  <th className="px-4 py-3 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0F4F2]">
                {items.map(item => (
                  <tr key={item.id} className="hover:bg-[#F8FCFA] transition">
                    <td className="whitespace-nowrap px-4 py-3 text-[#5A736C]">
                      <span className="font-mono">{formatDateTime(item.occurredAt)}</span>
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-[#17312F]">
                      <span className="rounded bg-[#F2F5F4] px-1.5 py-0.5 text-[11px] text-[#0B6B67]">
                        {item.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {roleBadge(item.actorRole)}
                        <span className="font-medium text-[#17312F]">
                          {item.actorDisplayName || item.actorUsername || `ID: ${item.actorUserId}`}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#5A736C]">
                      <span className="font-mono text-[11px]">
                        {item.entityType}:{item.entityId}
                      </span>
                    </td>
                    <td className="px-4 py-3">{outcomeBadge(item.outcome)}</td>
                    <td className="max-w-xs truncate px-4 py-3 font-mono text-[11px] text-[#6A817B]" title={item.metadata ?? ""}>
                      {item.metadata || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#EAF0EC] px-5 py-3.5">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-[#D5E3DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#48635C] transition hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={14} /> ก่อนหน้า
            </button>

            <span className="text-xs text-[#71837E]">
              หน้า {page + 1} / {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#D5E3DD] bg-white px-3 py-1.5 text-xs font-semibold text-[#48635C] transition hover:bg-[#F5F8F6] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ถัดไป <ChevronRight size={14} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
