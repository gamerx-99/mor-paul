# Remaining Work — Prioritized

> รายการนี้สะท้อนงานจริงที่ยังเหลือจากสถานะโครงการ ไม่ใช่รายการฟีเจอร์ใหม่ที่คาดเดาขึ้น

## P0 — ต้องตัดสินใจ/แต่งตั้งก่อน UAT ที่มีข้อมูลจริง

| ID | Work | Status | Owner decision/evidence required |
|---|---|---|---|
| P0-01 | ระบุ Clinic system owner, credential custodian, backup custodian, incident lead และผู้แทน | Blocked | เจ้าของโครงการต้องแต่งตั้งและเก็บหลักฐานภายในคลินิก |
| P0-02 | ยืนยันแผน backup, recovery และ retention ที่ใช้จริง | Pending | ระบุผู้รับผิดชอบ, ความถี่, ตำแหน่ง package และ policy ที่อนุมัติ |
| P0-03 | ทำ recovery drill บน environment ที่ไม่ใช่ production | Pending | ผล checklist, เวลา RTO ที่วัดได้ และ decision owner โดยไม่บันทึก PHI |
| P0-04 | ยืนยัน incident response และผู้ตรวจ manual monitoring | Pending | วิธีติดต่อ, escalation และ log format ที่ไม่มี PHI |

## P1 — UAT ของฟังก์ชันที่พัฒนาแล้ว

| ID | Work | Status | Acceptance criteria |
|---|---|---|---|
| P1-01 | UAT Mobile สำหรับ DOCTOR และ ASSISTANT | Pending | Bottom/mobile navigation แสดงถูกต้องตั้งแต่ first load; hard refresh/direct route/back-navigation/menu ได้ตามสิทธิ์ |
| P1-02 | UAT Cashier มีรายการยา | Pending | sign encounter → dispense → service charge (ถ้ามี) → invoice → full payment → `CLOSED` |
| P1-03 | UAT Cashier ไม่มีรายการยา | Pending | sign encounter → service charge → invoice → full payment → `CLOSED` โดยไม่บังคับ dispense |
| P1-04 | UAT National ID | Pending | checksum, uniqueness, write-once และ UI/API แสดงเฉพาะ masked value |
| P1-05 | UAT RBAC/pilot negative cases | Pending | ทุก role ถูกปฏิเสธเมื่อเรียก resource ที่ไม่ควรเข้าถึง; ไม่ใช่เพียงซ่อนปุ่ม |

## P2 — งานที่ถูก Blocked ด้วยข้อมูลหรือการอนุมัติภายนอก

| ID | Work | Status | Dependency |
|---|---|---|---|
| P2-01 | ทดสอบ Smart Card กับเครื่องหน้าเคาน์เตอร์จริง | Blocked | รุ่น reader, OS, driver และ Local Smart Card Bridge |
| P2-02 | ตัดสินใจขอบเขต document/file workflow | Blocked | privacy review, owner approval, private storage, validation/scan/retention/restore requirements |

## P3 — Go/No-go ก่อน pilot

| ID | Work | Status | Exit condition |
|---|---|---|---|
| P3-01 | ทบทวนผล UAT และ issue log | Pending | ไม่มี critical defect ด้าน PHI/RBAC/audit/idempotency หรือมี mitigation ที่อนุมัติ |
| P3-02 | ตรวจ checkpoint ล่าสุด | Pending | TypeScript check, Vitest และ production build ผ่าน; ระบุ version ID ได้ |
| P3-03 | อนุมัติ go/no-go | Pending | ผู้รับผิดชอบตาม operations runbook ยืนยันเกณฑ์ครบ |

## ห้ามทำโดยอัตโนมัติ

- ห้ามเพิ่ม Firebase, Google Apps Script, OAuth/SSO, file upload หรือ cloud service ใหม่เพียงเพราะอยู่ใน TODO
- ห้าม seed/mock PHI, medication หรือ transaction เพื่อทำ UAT
- ห้ามเปิด Smart Card direct access หรือส่งเลขบัตรเต็มผ่าน frontend
- ห้ามเปลี่ยน UI navigation logic เพื่อแก้เฉพาะ display state โดยไม่มีอนุมัติ

