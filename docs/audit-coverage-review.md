# Audit Coverage Review — Phase 1 Hardening

เอกสารนี้เป็นผลทบทวน mutation ของ Clinic Mor Phallop HIS หลังเพิ่ม hardening สำหรับ local authentication โดยตรวจจาก helper ที่เป็น transaction boundary และ procedure ที่ครอบด้วย role middleware การทบทวนนี้ไม่ใช้หรือสร้างข้อมูลผู้รับบริการใด ๆ

| ขอบเขต | Mutation ที่ตรวจ | Audit action หลัก | ข้อมูล metadata ที่อนุญาต |
|---|---|---|---|
| Authentication | bootstrap, login สำเร็จ/ล้มเหลว, เปลี่ยนรหัสผ่าน, logout | `AUTH_LOGIN_SUCCEEDED`, `AUTH_LOGIN_FAILED`, `AUTH_PASSWORD_CHANGED`, `AUTH_PASSWORD_CHANGE_DENIED`, `AUTH_LOGOUT` | วิธีเข้าสู่ระบบ, เหตุผลเชิงเทคนิค, สถานะเพิกถอน session; ไม่เก็บ password, hash หรือ token |
| Staff | สร้างบัญชี, เปลี่ยนบทบาท, เปิด/ปิดใช้ | `STAFF_ACCOUNT_*`, `STAFF_ROLE_CHANGED` | role, สถานะเปิดใช้, สถานะการเพิกถอน session |
| Front Desk | ลงทะเบียนผู้รับบริการ, สร้าง visit, triage, เรียกคิว | `PATIENT_REGISTERED`, `VISIT_CREATED`, `TRIAGE_*`, `QUEUE_CALLED` | identifier เชิงเทคนิค, queue number, urgency; ไม่มีชื่อ, HN, อาการ, ที่อยู่ หรือ note |
| Doctor Console | บันทึก draft และลงนาม encounter/order | `CLINICAL_NOTE_DRAFT_SAVED`, `CLINICAL_ENCOUNTER_SIGNED`, `MEDICATION_ORDER_SIGNED` | visit/note/order identifier, revision และจำนวนรายการ; ไม่มี SOAP, diagnosis display หรือ instructions |
| Pharmacy/Cashier | เพิ่ม catalog, ตั้งราคา, รับ lot, dispense, invoice, payment | `MEDICATION_*`, `INVENTORY_LOT_RECEIVED`, `DISPENSATION_*`, `INVOICE_*`, `PAYMENT_*` | identifier, จำนวน, ยอดเงิน, สถานะ idempotency; ไม่มีชื่อหรือ HN |

## ข้อสรุปการควบคุม

Mutation สำคัญทั้งหมดส่ง `AuditContext` ที่ประกอบด้วย `actorUserId`, `actorRole` และ `requestId` เข้าสู่ transaction เดียวกับการเปลี่ยนแปลงข้อมูลหลัก และบันทึก `entityType`, `entityId`, `outcome` และเวลาจากฐานข้อมูล การ replay ของ idempotency ที่ไม่เปลี่ยนข้อมูลจะคืนผลเดิมโดยไม่สร้าง audit event ซ้ำ เพื่อให้ audit trail สะท้อนการเปลี่ยนสถานะจริง

การปฏิเสธจาก RBAC เกิดใน tRPC middleware ก่อน procedure business logic โดย `clinicalReadProcedure` ปิดกั้น `SYSTEM_ADMIN` จากข้อมูลผู้รับบริการตั้งแต่ต้นทาง ระบบทดสอบ negative RBAC ครอบคลุม Front Desk, Doctor Console, Staff และ Pharmacy/Cashier แล้ว ส่วน hardening เพิ่มกรณี password mismatch, successful password change, local rate limit และ login audit-aware helper โดยไม่แตะฐานข้อมูลจริง

> Audit payload ต้องใช้เฉพาะ metadata เชิงเทคนิคที่จำเป็นต่อการติดตามเหตุการณ์ ห้ามบันทึกรหัสผ่าน, password hash, session token, HN, ชื่อ, อาการ, SOAP หรือข้อความทางคลินิก

## Coverage register ที่ตรวจสอบได้

| พื้นที่ | หลักฐานการทบทวน mutation | หลักฐานการควบคุมสิทธิ์/ข้อผิดพลาด | สถานะ |
|---|---|---|---|
| Authentication | `server/db.ts`: bootstrap/login/logout/change password audit helpers | `server/auth.bootstrap.test.ts`, `server/auth.logout.test.ts`, `server/auth.hardening.test.ts` ครอบคลุม password mismatch, unauthenticated change password, generic rate-limit denial และ success path | ผ่าน |
| Staff | `createStaffAccount`, `setStaffAccountActive`, `updateStaffRole` | `server/staff.rbac.test.ts` ปฏิเสธ DOCTOR/ASSISTANT และตรวจ SYSTEM_ADMIN boundary | ผ่าน |
| Front Desk/Queue | `createPatient`, `createVisit`, `createTriageRecord`, `updateQueueEntry` | `server/frontDesk.rbac.test.ts` ตรวจ procedure ที่ห้าม role อื่นทำงาน | ผ่าน |
| Doctor Console | `saveClinicalDraft`, `signClinicalEncounter`, `createMedicationOrder` | `server/doctorConsole.rbac.test.ts` ตรวจ assistant/admin denial และ doctor path | ผ่าน |
| Pharmacy/Cashier | catalog/price/lot helpers, `dispenseSignedOrder`, `receiveInvoicePayment` | `server/pharmacy.rbac.test.ts` ครอบคลุม RBAC, idempotency replay และ domain-error mapping ของ dispense/payment | ผ่าน |
| Session-expiry UI | ไม่มี mutation ธุรกิจ; clear cache ก่อนสลับเป็น AccessGate | `server/sessionExpiry.test.ts` ตรวจ transition จาก protected workspace, repeated-expiry idempotency และ event/notice flag | ผ่าน |

การรันยืนยันล่าสุดใช้ `pnpm check`, `pnpm test` และ `pnpm build` โดยชุดทดสอบรวมประกอบด้วย 8 ไฟล์ และต้องผ่านก่อน checkpoint ต่อไป เอกสารนี้เป็น coverage review ของโค้ดและ mock-based tests เท่านั้น ไม่ใช่หลักฐานแทนการทำ UAT หรือ disaster-recovery test กับข้อมูลจริง
