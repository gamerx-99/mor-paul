# Current State

> **สถานะ ณ วันที่ 20 สิงหาคม 2026 (GMT+7):** ฟังก์ชันหลักพัฒนาแล้ว; พร้อมสำหรับ UAT แบบควบคุมสิทธิ์ แต่ยังไม่พร้อมเปิดใช้งานจริงจนกว่าจะปิดงาน UAT และ operational go/no-go

## สรุปสถานะระบบ

| ด้าน | สถานะ | หลักฐาน/หมายเหตุ |
|---|---|---|
| สแตกและฐานข้อมูล | Completed | React/Express/tRPC/Drizzle และ MySQL-compatible database ใช้งานแล้ว |
| Local authentication และ RBAC | Completed | บัญชีภายใน, session, 3 roles, server-side procedures |
| Front Desk, HN, visit | Completed | ลงทะเบียน ค้นหา HN และสร้าง visit โดยไม่มี seed data |
| Triage และ queue | Completed | ผู้ช่วยคัดกรอง; แพทย์/ผู้ช่วยเห็นข้อมูลตามสิทธิ์ |
| Doctor Console / EMR | Completed | SOAP draft, diagnosis, medication order และ sign encounter |
| Pharmacy และ Cashier | Completed | catalog/price/lot/FEFO, dispense, service charge, invoice, payment |
| Reports v1 | Completed | aggregate-only report และ CSV export ป้องกัน formula injection |
| CSV import คลังยา/ราคา | Completed | template, validation, preview และ atomic commit |
| เลขบัตรประชาชน | Completed | checksum, encryption, lookup hash, write-once, masked-only response |
| Smart Card device integration | Blocked | มี local bridge contract/fallback แล้ว; รอรุ่นเครื่องอ่านและ OS จริง |
| File/document upload | Pending by design | ปิดใช้งานจนกว่าจะอนุมัติ privacy/storage/retention controls |
| Operational readiness | In Progress | รอเจ้าของงาน, backup/recovery drill, incident/monitoring evidence |

## สิ่งที่ตรวจสอบผ่านแล้ว

ตามรายงานสถานะก่อนสร้างชุดเอกสารนี้ โครงการผ่าน **TypeScript check**, **Vitest 68 tests** และ **production build** ใน checkpoint ฟังก์ชันล่าสุด ทั้งนี้ชุด Shared Project Context เป็นเอกสารเท่านั้นและไม่แก้ source code หรือ schema

## สถานะที่ต้องตีความอย่างระมัดระวัง

1. คำว่า **Completed** หมายถึงโค้ดและการทดสอบตาม scope ที่ตกลงมีอยู่แล้ว ไม่ได้หมายถึงได้รับการรับรองทางกฎหมายหรือพร้อมใช้ PHI ในทุกสถานการณ์
2. คำว่า **Pending** หมายถึงยังไม่มีการดำเนินการหรือยังรอการอนุมัติ/หลักฐานจากเจ้าของโครงการ ไม่ควรสรุปเองว่าเป็นฟีเจอร์ที่จะสร้าง
3. คำว่า **Blocked** หมายถึงต้องมีข้อมูลหรือการตัดสินใจภายนอกก่อนจึงจะทำต่อได้ เช่น รุ่นเครื่องอ่าน Smart Card, OS และ driver

## สถานะล่าสุดของเอกสารและ checkpoint

| รายการ | สถานะ |
|---|---|
| Checkpoint ฟังก์ชันล่าสุดที่รายงานสถานะอ้างอิง | `d113c0da` — เลขบัตรประชาชน write-once และ Smart Card boundary |
| Checkpoint เอกสาร Project Status Report | `9e343131` |
| Shared Project Context | Completed; จัดทำครบ 12 ไฟล์ภายใต้ `docs/project-context/` โดยไม่มีการเปลี่ยนแปลง source code |

## เงื่อนไขก่อน pilot/เปิดใช้จริง

ต้องมีผล UAT ครบทุกบทบาทและ workflow สำคัญ, ระบุ Clinic system owner/credential custodian/backup custodian/incident lead, ผ่าน recovery drill ใน environment ที่ไม่ใช่ production, ไม่มี critical defect ด้าน PHI/RBAC/audit/idempotency และมี checkpoint ที่ตรวจสอบ check/test/build ผ่าน
