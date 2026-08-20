import { FileText, Printer, Send, X } from "lucide-react";
import React, { useState } from "react";

export type MedicalCertificatePrintProps = {
  doctor: {
    name: string;
    licenseNumber?: string;
  };
  patient: {
    hn: string;
    firstName: string;
    lastName: string;
    gender?: string;
    dateOfBirth?: string;
    allergySummary?: string | null;
  };
  encounter: {
    visitDate: string;
    chiefComplaint?: string;
    subjective?: string | null;
    objective?: string | null;
    assessment?: string | null;
    plan?: string | null;
    signedAt?: string | Date | null;
    bloodPressureSystolic?: number | null;
    bloodPressureDiastolic?: number | null;
    pulse?: number | null;
    temperatureCelsius?: string | number | null;
    weightKg?: string | number | null;
    heightCm?: string | number | null;
  };
  diagnoses: Array<{ code?: string | null; display: string }>;
  medications?: Array<{
    medicationNameSnapshot: string;
    strengthSnapshot: string;
    dose: string;
    frequency: string;
    quantityPrescribed: number;
    instructions?: string | null;
  }>;
  onClose: () => void;
};

function formatThaiDate(dateVal?: string | Date | null) {
  const d = dateVal ? new Date(dateVal) : new Date();
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function calculateAge(dobStr?: string): string {
  if (!dobStr) return "-";
  const dob = new Date(dobStr);
  if (Number.isNaN(dob.getTime())) return "-";
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) {
    age--;
  }
  return `${age} ปี`;
}

export default function MedicalCertificatePrint({
  doctor,
  patient,
  encounter,
  diagnoses,
  medications = [],
  onClose,
}: MedicalCertificatePrintProps) {
  const [docType, setDocType] = useState<"certificate" | "referral">("certificate");

  // Certificate customizable fields
  const [restDays, setRestDays] = useState("1");
  const [restStartDate, setRestStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [doctorOpinion, setDoctorOpinion] = useState(
    "เห็นสมควรให้หยุดพักรักษาตัว เพื่อให้ร่างกายฟื้นฟูจากการเจ็บป่วย"
  );
  const [doctorLicense, setDoctorLicense] = useState(doctor.licenseNumber || "ว. 12345");

  // Referral customizable fields
  const [referralDestination, setReferralDestination] = useState(
    "ผู้อำนวยการโรงพยาบาล / แพทย์ผู้ตรวจรักษา"
  );
  const [referralReason, setReferralReason] = useState(
    "เพื่อตรวจวินิจฉัยเพิ่มเติมทางห้องปฏิบัติการ/รังสีวิทยา และให้การรักษาต่ออย่างเหมาะสม"
  );

  function handlePrint() {
    window.print();
  }

  const diagnosisText = diagnoses.map(d => (d.code ? `[${d.code}] ${d.display}` : d.display)).join(", ") || "-";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="flex h-full max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl print:max-h-none print:w-full print:rounded-none print:shadow-none">
        {/* Navigation & Toolbar - Hidden on Print */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#D5E3DD] bg-[#EAF4F0] px-6 py-4 print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-[#BBD8CE] bg-white p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDocType("certificate")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
                  docType === "certificate" ? "bg-[#0B6B67] text-white" : "text-[#5C726C] hover:text-[#17312F]"
                }`}
              >
                <FileText size={14} /> ใบรับรองแพทย์ (A4)
              </button>
              <button
                type="button"
                onClick={() => setDocType("referral")}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition ${
                  docType === "referral" ? "bg-[#0B6B67] text-white" : "text-[#5C726C] hover:text-[#17312F]"
                }`}
              >
                <Send size={14} /> ใบส่งตัวผู้ป่วย (A4)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0B6B67] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#095956] active:scale-95"
            >
              <Printer size={16} /> พิมพ์เอกสาร (A4)
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#D5E3DD] p-2 text-[#5C726C] transition hover:bg-[#D5E3DD]/40"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Form Options Drawer - Hidden on Print */}
        <div className="border-b border-[#D5E3DD] bg-[#F7FCFA] px-6 py-3 text-xs print:hidden">
          {docType === "certificate" ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 items-end">
              <div>
                <span className="block font-semibold text-[#526861] mb-1">เลขที่ใบประกอบวิชาชีพ (ว.):</span>
                <input
                  value={doctorLicense}
                  onChange={e => setDoctorLicense(e.target.value)}
                  className="h-8 w-full rounded border border-[#BBD8CE] bg-white px-2 text-xs"
                />
              </div>
              <div>
                <span className="block font-semibold text-[#526861] mb-1">จำนวนวันพักรักษาตัว:</span>
                <input
                  type="number"
                  min="0"
                  value={restDays}
                  onChange={e => setRestDays(e.target.value)}
                  className="h-8 w-full rounded border border-[#BBD8CE] bg-white px-2 text-xs"
                  placeholder="เช่น 1 หรือ 0 ถ้าไม่หยุดงาน"
                />
              </div>
              <div>
                <span className="block font-semibold text-[#526861] mb-1">ความเห็น/คำแนะนำแพทย์:</span>
                <input
                  value={doctorOpinion}
                  onChange={e => setDoctorOpinion(e.target.value)}
                  className="h-8 w-full rounded border border-[#BBD8CE] bg-white px-2 text-xs"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 items-end">
              <div>
                <span className="block font-semibold text-[#526861] mb-1">ส่งตัวถึง (โรงพยาบาล/แพทย์):</span>
                <input
                  value={referralDestination}
                  onChange={e => setReferralDestination(e.target.value)}
                  className="h-8 w-full rounded border border-[#BBD8CE] bg-white px-2 text-xs"
                />
              </div>
              <div>
                <span className="block font-semibold text-[#526861] mb-1">เหตุผลในการส่งตัว:</span>
                <input
                  value={referralReason}
                  onChange={e => setReferralReason(e.target.value)}
                  className="h-8 w-full rounded border border-[#BBD8CE] bg-white px-2 text-xs"
                />
              </div>
            </div>
          )}
        </div>

        {/* Document Printable Preview */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#F4F6F5] print:overflow-visible print:bg-white print:p-0">
          <div className="mx-auto max-w-[210mm] min-h-[297mm] bg-white p-[15mm] shadow-lg border border-[#D5E3DD] text-[#17312F] print:max-w-none print:min-h-0 print:border-none print:p-0 print:shadow-none">
            {/* Header */}
            <div className="text-center border-b-2 border-[#17312F] pb-4">
              <h1 className="text-xl font-bold tracking-tight text-[#0B6B67] print:text-black">
                คลินิกเวชกรรมหมอพัลลภ
              </h1>
              <p className="text-xs text-[#5C726C] print:text-black mt-0.5">
                123/45 ถนนสุขภาพดี ตำบลในเมือง อำเภอเมือง จังหวัดนนทบุรี 11000 · โทร. 02-xxx-xxxx
              </p>
              <p className="text-[11px] text-[#71837E] print:text-black">
                ใบอนุญาตให้ประกอบกิจการสถานพยาบาล เลขที่ 1010100001
              </p>
              <div className="mt-3 inline-block border-2 border-[#17312F] px-6 py-1 font-bold text-sm">
                {docType === "certificate" ? "ใบรับรองแพทย์ (MEDICAL CERTIFICATE)" : "ใบส่งตัวผู้ป่วย (PATIENT REFERRAL FORM)"}
              </div>
            </div>

            {docType === "certificate" ? (
              /* Medical Certificate Content */
              <div className="mt-6 text-sm leading-relaxed space-y-4">
                <div className="text-right text-xs">
                  <p><strong>วันที่ออกเอกสาร:</strong> {formatThaiDate(encounter.signedAt || encounter.visitDate)}</p>
                </div>

                <div className="border border-[#D5E3DD] rounded-lg p-4 bg-[#FBFDFD] print:bg-transparent print:border-black space-y-3">
                  <p>
                    ข้าพเจ้า <strong>{doctor.name}</strong> ผู้ประกอบวิชาชีพเวชกรรม ใบอนุญาตประกอบวิชาชีพเลขที่ <strong>{doctorLicense}</strong>
                  </p>
                  <p>
                    ได้ทำการตรวจร่างกาย <strong>{patient.firstName} {patient.lastName}</strong> รหัสประจำตัวผู้ป่วย (HN): <strong>{patient.hn}</strong> เพศ <strong>{patient.gender === "MALE" ? "ชาย" : patient.gender === "FEMALE" ? "หญิง" : "ไม่ระบุ"}</strong> อายุ <strong>{calculateAge(patient.dateOfBirth)}</strong>
                  </p>
                  <p>
                    เมื่อวันที่ <strong>{formatThaiDate(encounter.visitDate)}</strong> ณ คลินิกเวชกรรมหมอพัลลภ
                  </p>
                </div>

                {/* Vital signs */}
                <div className="rounded-lg border border-[#E1ECE7] p-3 text-xs bg-[#F7FCFA] print:bg-transparent print:border-black">
                  <p className="font-bold text-[#0B6B67] print:text-black mb-1">ผลการตรวจสัญญาณชีพเบื้องต้น:</p>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-[11px]">
                    <span>ความดัน: <strong>{encounter.bloodPressureSystolic && encounter.bloodPressureDiastolic ? `${encounter.bloodPressureSystolic}/${encounter.bloodPressureDiastolic} mmHg` : "-"}</strong></span>
                    <span>ชีพจร: <strong>{encounter.pulse ? `${encounter.pulse} bpm` : "-"}</strong></span>
                    <span>อุณหภูมิ: <strong>{encounter.temperatureCelsius ? `${encounter.temperatureCelsius} °C` : "-"}</strong></span>
                    <span>น้ำหนัก: <strong>{encounter.weightKg ? `${encounter.weightKg} kg` : "-"}</strong></span>
                    <span>ส่วนสูง: <strong>{encounter.heightCm ? `${encounter.heightCm} cm` : "-"}</strong></span>
                  </div>
                </div>

                {/* Diagnosis */}
                <div className="space-y-1">
                  <p className="font-bold">การวินิจฉัยโรค (Diagnosis):</p>
                  <div className="rounded-lg border border-[#D5E3DD] p-3 bg-white print:border-black font-semibold text-[#0B6B67] print:text-black">
                    {diagnosisText}
                  </div>
                </div>

                {/* Opinion */}
                <div className="space-y-1">
                  <p className="font-bold">ความเห็นของแพทย์ (Medical Opinion / Recommendation):</p>
                  <div className="rounded-lg border border-[#D5E3DD] p-3 bg-white print:border-black space-y-2">
                    <p>{doctorOpinion}</p>
                    {Number(restDays) > 0 && (
                      <p className="font-bold text-[#17312F]">
                        เห็นสมควรให้หยุดพักรักษาตัว / ลาหยุดงาน เป็นเวลา <strong>{restDays}</strong> วัน นับตั้งแต่วันที่ <strong>{formatThaiDate(restStartDate)}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* Signature */}
                <div className="mt-16 text-right">
                  <div className="inline-block text-center w-64">
                    <p className="border-b border-dashed border-gray-400 pb-1 mb-1 font-semibold">
                      ( {doctor.name} )
                    </p>
                    <p className="text-xs text-[#5C726C] print:text-black">แพทย์ผู้ตรวจรักษา</p>
                    <p className="text-[11px] text-[#71837E] print:text-black">เลข ว. {doctorLicense}</p>
                  </div>
                </div>
              </div>
            ) : (
              /* Referral Letter Content */
              <div className="mt-6 text-sm leading-relaxed space-y-4">
                <div className="text-right text-xs">
                  <p><strong>วันที่ส่งตัว:</strong> {formatThaiDate(encounter.signedAt || encounter.visitDate)}</p>
                </div>

                <div>
                  <p><strong>เรียน:</strong> {referralDestination}</p>
                </div>

                <div className="border border-[#D5E3DD] rounded-lg p-3.5 bg-[#FBFDFD] print:bg-transparent print:border-black text-xs space-y-1.5">
                  <p className="font-bold text-sm text-[#0B6B67] print:text-black">ข้อมูลผู้ป่วย:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <p>ชื่อ-นามสกุล: <strong>{patient.firstName} {patient.lastName}</strong></p>
                    <p>HN: <strong>{patient.hn}</strong></p>
                    <p>เพศ: <strong>{patient.gender === "MALE" ? "ชาย" : "หญิง"}</strong> | อายุ: <strong>{calculateAge(patient.dateOfBirth)}</strong></p>
                    <p>ประวัติแพ้ยา: <strong className="text-red-600 print:text-black">{patient.allergySummary || "ปฏิเสธประวัติแพ้ยา"}</strong></p>
                  </div>
                </div>

                {/* Clinical Notes Summary */}
                <div className="space-y-2 text-xs">
                  <div className="rounded border border-[#D5E3DD] p-2.5">
                    <p className="font-bold text-[#0B6B67] print:text-black">อาการสำคัญ (Chief Complaint):</p>
                    <p className="mt-0.5">{encounter.chiefComplaint || encounter.subjective || "-"}</p>
                  </div>

                  <div className="rounded border border-[#D5E3DD] p-2.5">
                    <p className="font-bold text-[#0B6B67] print:text-black">การวินิจฉัยเบื้องต้น (Provisional Diagnosis):</p>
                    <p className="mt-0.5 font-semibold">{diagnosisText}</p>
                  </div>

                  {medications.length > 0 && (
                    <div className="rounded border border-[#D5E3DD] p-2.5">
                      <p className="font-bold text-[#0B6B67] print:text-black">ยาและการรักษาที่ได้รับไปเบื้องต้น:</p>
                      <ul className="mt-1 list-disc pl-4 space-y-0.5">
                        {medications.map((m, idx) => (
                          <li key={idx}>
                            {m.medicationNameSnapshot} {m.strengthSnapshot} — {m.dose} {m.frequency} ({m.quantityPrescribed})
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="rounded border border-[#D5E3DD] p-2.5 bg-[#FBFDFD] print:bg-transparent">
                    <p className="font-bold text-[#0B6B67] print:text-black">เหตุผลในการส่งตัว (Reason for Referral):</p>
                    <p className="mt-0.5">{referralReason}</p>
                  </div>
                </div>

                {/* Signature */}
                <div className="mt-12 text-right">
                  <div className="inline-block text-center w-64">
                    <p className="border-b border-dashed border-gray-400 pb-1 mb-1 font-semibold">
                      ( {doctor.name} )
                    </p>
                    <p className="text-xs text-[#5C726C] print:text-black">แพทย์ผู้ส่งตัว</p>
                    <p className="text-[11px] text-[#71837E] print:text-black">โทรศัพท์ติดต่อคลินิก: 02-xxx-xxxx</p>
                  </div>
                </div>
              </div>
            )}

            <div className="mt-8 text-center text-[9px] text-[#71837E] print:text-black">
              * เอกสารนี้จัดทำขึ้นโดยระบบเวชระเบียนอิเล็กทรอนิกส์ คลินิกเวชกรรมหมอพัลลภ
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
