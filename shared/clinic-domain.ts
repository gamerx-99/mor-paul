/**
 * Clinic HIS domain contracts. These types are data-shape contracts only;
 * they must not be treated as authorization and contain no sample PHI.
 */
export type UserRole = "DOCTOR" | "ASSISTANT" | "SYSTEM_ADMIN";
export type EncounterStatus = "REGISTERED" | "TRIAGED" | "WAITING_DOCTOR" | "IN_CONSULT" | "DISPENSING" | "BILLED" | "CLOSED" | "CANCELLED";
export type QueueStatus = "WAITING" | "CALLED" | "IN_CONSULT" | "COMPLETED" | "CANCELLED";
export type TriageUrgency = "ROUTINE" | "PRIORITY" | "URGENT";
export type ClinicalOrderStatus = "DRAFT" | "SIGNED" | "CANCELLED";
export type DispensationStatus = "PENDING" | "COMPLETED" | "VOIDED";
export type InvoiceStatus = "DRAFT" | "ISSUED" | "PAID" | "VOID";
export type DocumentKind = "CONSENT" | "ID_COPY" | "LAB" | "REFERRAL" | "OTHER";

export interface RequestContext { requestId: string; actorUid: string; actorRole: UserRole; occurredAt: string; }
export interface PatientRef { patientId: string; hn: string; displayName: string; dateOfBirth?: string; }
export interface EncounterRef { encounterId: string; patientId: string; sequence: string; status: EncounterStatus; openedAt: string; }
export interface VitalSigns { bpSystolic?: number; bpDiastolic?: number; pulse?: number; temperatureC?: number; weightKg?: number; heightCm?: number; recordedAt: string; }
export interface TriageRef { triageId: string; encounterId: string; urgency: TriageUrgency; recordedAt: string; }
export interface QueueRef { queueId: string; encounterId: string; queueNumber: number; status: QueueStatus; queuedAt: string; }
export interface MedicationOrder { orderId: string; encounterId: string; drugId: string; quantity: number; instruction: string; status: ClinicalOrderStatus; }
export interface Dispensation { dispensationId: string; encounterId: string; orderId: string; status: DispensationStatus; }
export interface Invoice { invoiceId: string; encounterId: string; totalSatang: number; status: InvoiceStatus; }
export interface DocumentAsset { assetId: string; patientId: string; encounterId?: string; kind: DocumentKind; storagePath: string; contentType: string; sizeBytes: number; status: "PENDING_SCAN" | "AVAILABLE" | "QUARANTINED"; }
export interface AuditEvent { eventId: string; occurredAt: string; actorUid: string; actorRole: UserRole; action: string; entityType: string; entityId: string; outcome: "ALLOWED" | "DENIED" | "FAILED"; requestId: string; metadata?: Record<string, string | number | boolean>; }
export interface IdempotentCommand<T> { requestId: string; idempotencyKey: string; payload: T; }

export const ROLE_LABEL: Record<UserRole, string> = { DOCTOR: "แพทย์", ASSISTANT: "ผู้ช่วย", SYSTEM_ADMIN: "ผู้ดูแลระบบ" };
export const ENCOUNTER_LABEL: Record<EncounterStatus, string> = { REGISTERED: "ลงทะเบียน", TRIAGED: "คัดกรองแล้ว", WAITING_DOCTOR: "รอพบแพทย์", IN_CONSULT: "อยู่ระหว่างตรวจ", DISPENSING: "รอจ่ายยา", BILLED: "ออกบิลแล้ว", CLOSED: "ปิดรายการ", CANCELLED: "ยกเลิกรายการ" };
export const QUEUE_LABEL: Record<QueueStatus, string> = { WAITING: "รอเรียก", CALLED: "เรียกแล้ว", IN_CONSULT: "อยู่ระหว่างตรวจ", COMPLETED: "เสร็จสิ้น", CANCELLED: "ยกเลิก" };
export const TRIAGE_URGENCY_LABEL: Record<TriageUrgency, string> = { ROUTINE: "ปกติ", PRIORITY: "เร่งด่วน", URGENT: "ต้องพบแพทย์โดยเร็ว" };
