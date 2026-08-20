# Feature Scope

## Completed

| Module | ความสามารถที่มีอยู่จริง |
|---|---|
| Local Access | one-time bootstrap ของ System Admin, local login/logout, password policy, rate limiting, session expiry/revocation |
| Staff Management | จัดการบัญชีบุคลากร/role/active status, เปลี่ยนรหัสผ่าน, ป้องกัน self-change และ last-active-admin loss |
| Front Desk | ค้นหา HN, ลงทะเบียนผู้รับบริการ, สร้าง visit, บันทึกเลขบัตรประชาชนครั้งแรก |
| Triage & Queue | บันทึก vital/urgency, จัดคิว/เรียกคิว และ board ตามบทบาท |
| Doctor Console | SOAP draft, diagnosis, medication order, optimistic revision และ sign encounter |
| Medication Catalog | ยา, active price, inventory lot และ CSV import แบบ template/validate/preview/atomic commit |
| Dispensing | จ่ายยาจาก order ที่ลงนามและตัดสต็อกตาม FEFO พร้อม movement/audit |
| Cashier | เพิ่มค่าบริการแยกจากยา, invoice line snapshot, รับชำระ idempotent และปิด visit หลังชำระสำเร็จ |
| Reports v1 | ตัวชี้วัด visit/revenue/inventory แบบ aggregate และ CSV formula-injection protection |
| National ID | Thai checksum validation, encryption at rest, unique lookup, write-once, masked-only output |
| Smart Card boundary | client contract สำหรับ local bridge และ manual-entry fallback; ไม่ใช่ driver integration |

## In Progress

| Workstream | สถานะ |
|---|---|
| UAT preparation and controlled validation | โค้ดหลักเสร็จแล้ว แต่ยังต้องเก็บผล UAT/operational evidence จากคลินิก |

## Pending

| Workstream | เหตุผลที่ยังไม่เริ่ม/ยังไม่ปิด |
|---|---|
| UAT มือถือสำหรับ DOCTOR/ASSISTANT | ต้องทดสอบบนโทรศัพท์จริง: hard refresh, direct route, เปลี่ยนหน้า และ menu ที่มีสิทธิ์ |
| UAT Cashier | ต้องทดสอบทั้งมีและไม่มีรายการยา ตั้งแต่ sign encounter ถึง payment/close |
| UAT National ID | ต้องยืนยัน checksum, duplicate, write-once และ masked output ใน workflow จริง |
| RBAC/pilot gate | ต้องทดสอบ negative cases จาก client ของแต่ละบทบาทและบันทึกผล UAT ที่ไม่ใส่ PHI |
| Backup/recovery/incident monitoring | ต้องตั้ง owner, retention/backup evidence, recovery drill และ manual monitoring record |
| Document/file capability | ยังไม่มี scope ที่อนุมัติสำหรับ private storage, retention, validation, scan และ restore |

## Blocked

| Workstream | สิ่งที่ต้องได้รับก่อน |
|---|---|
| Smart Card device integration | รุ่นเครื่องอ่าน, OS, driver ที่ใช้ในเครื่องหน้าเคาน์เตอร์ และการตั้งค่า Local Smart Card Bridge |
| เริ่ม UAT ที่มีข้อมูลจริง | ระบุ Clinic system owner, credential custodian, backup custodian, incident lead และผู้แทนก่อน |
| เปิดรับไฟล์ PHI | Owner-approved workflow, privacy review, private storage controls, file validation, scan, retention และ restore test |

## นอกขอบเขตปัจจุบัน

ไม่มีหลักฐานว่า Firebase, Google Apps Script, OAuth/SSO, external identity provider, document upload, direct USB smart-card access, medical diagnosis catalogue, หรือ seed data ถูกอนุมัติให้พัฒนาใน scope ปัจจุบัน จึงห้ามเพิ่มโดยอัตโนมัติ
