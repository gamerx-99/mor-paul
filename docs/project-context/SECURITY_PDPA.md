# Security and PDPA Constraints

> เอกสารนี้บันทึกมาตรการเชิงระบบและข้อกำหนดการทำงานจากโครงการ ไม่ใช่คำรับรองการปฏิบัติตามกฎหมายหรือคำปรึกษากฎหมาย

## Privacy Principles

| หลักการ | ข้อกำหนดที่ต้องรักษา |
|---|---|
| Need-to-know | API/query/UI ส่งข้อมูลเท่าที่ role ต้องใช้สำหรับงาน |
| Data minimization | ไม่สร้าง aggregate/exports ที่คืน HN, ชื่อ, diagnosis, invoice identifier หรือ payment reference โดยไม่มีสิทธิ์ |
| Zero-PHI System Admin | System Admin ไม่มีเส้นทางเข้าถึง PHI หรือ patient-level clinical data |
| Auditability | mutation สำคัญต้องมี actor, role, entity, outcome, request ID และเวลา |
| Secure operations | ห้ามส่ง secret หรือ PHI ในแชต, ticket, screenshot หรือ operation log |

## Controls ที่พัฒนาแล้ว

| Area | Control |
|---|---|
| Authentication | scrypt password hash, password policy, local session cookie, session hash/revocation และ rate limit |
| Authorization | server-side tRPC procedures และ role-scoped query; UI ไม่ใช่ authorization source |
| PHI access | server filters data ตาม role และ System Admin ถูกจำกัด zero-PHI |
| Error handling | map database/infrastructure error เป็นข้อความปลอดภัย ไม่เผย SQL/parameter |
| Audit | audit events สำหรับ mutation สำคัญ และ metadata ห้ามบันทึกเวชระเบียน/PHI |
| Billing/stock | transaction, idempotency และ trace back ของ stock movement/invoice/payment |
| Reports | aggregate-only; maximum query range ที่รายงานกำหนดคือ 93 วัน และ CSV ป้องกัน formula injection |
| National ID | AES-256-GCM encryption at rest, HMAC-SHA256 lookup hash, write-once, masked-only response |

## National ID Handling

เลขบัตรประชาชนต้องผ่าน Thai checksum validation ก่อนบันทึก เก็บ ciphertext และ unique lookup hash แยกกัน; client-facing response ต้องแสดงเพียง 2 หลักแรกและ 3 หลักท้าย เช่น `12••••••••345` ห้ามส่งค่าเต็มหรือ ciphertext กลับใน API ปกติ ห้ามแก้ไขผ่าน normal workflow หลังบันทึก

## Audit Data Rule

Audit event บันทึก metadata เชิงเทคนิค/บริบทได้ เช่น action, actor, role, entity ID, outcome, request ID และ timestamp แต่ต้องไม่คัดลอกชื่อผู้รับบริการ, HN, SOAP, diagnosis, prescription, เลขบัตร, เนื้อหาไฟล์ หรือ payment detail ลง metadata

## File/Document Scope

การอัปโหลด/จัดเก็บใบยินยอม รูปบัตร ผลตรวจ เสียง หรือไฟล์ PHI **ปิดอยู่** ในรุ่นปัจจุบัน ห้ามเปิดจนกว่าจะได้รับอนุมัติสำหรับ private storage, server-side authorization, MIME/extension allowlist, size limit, malware scan, retention policy, backup/recovery และ restore test

## Operational PDPA Requirements Before Pilot

1. แยก development และ production/UAT database และห้ามคัดลอก PHI จาก production ไป development
2. ระบุ owner ของ system, credential, backup และ incident พร้อมผู้แทน
3. ห้ามแชร์บัญชีบุคลากร; ใช้ least privilege และ role จริง
4. UAT checklist, screenshots และ issue logs ต้องไม่บันทึก PHI
5. หากสงสัย PHI exposure ให้หยุด session ที่เกี่ยวข้อง แจ้ง incident lead และห้ามนำ PHI ไปไว้ใน log/chat

