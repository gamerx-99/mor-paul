# Clinic HIS — Project Overview

> **สถานะเอกสาร:** Shared Project Context  
> **ขอบเขตหลักฐาน:** ซอร์สโค้ด, schema, tests, ADR และเอกสารโครงการที่มีอยู่ ณ วันที่ 20 สิงหาคม 2026 (GMT+7)  
> **รุ่นเอกสารล่าสุดก่อนสร้างชุดนี้:** `9e343131`; การเปลี่ยนแปลงฟังก์ชันล่าสุดที่อ้างอิงในรายงานสถานะคือ `d113c0da`

## วัตถุประสงค์

**คลินิกหมอพัลลภ (Clinic HIS)** เป็นระบบ Hospital Information System สำหรับคลินิกขนาดเล็ก ออกแบบให้รองรับลำดับงานตั้งแต่ลงทะเบียนผู้รับบริการ คัดกรองคิว ห้องตรวจ คลังยา การเงิน และรายงานสรุป โดยคงสแตกเทคนิคให้น้อยที่สุดและใช้หลัก **Need-to-know** สำหรับข้อมูลสุขภาพส่วนบุคคล (PHI)

ระบบตั้งเป้ารองรับปริมาณงานเริ่มต้นประมาณ **100 เคสต่อเดือน** โดยเน้นความถูกต้องของ workflow และการตรวจสอบย้อนหลัง มากกว่าการเพิ่มบริการภายนอกหรือความสามารถที่ไม่จำเป็นต่อคลินิกขนาดเล็ก

## เป้าหมายที่ตกลงแล้ว

| เป้าหมาย | แนวทางที่ใช้จริง |
|---|---|
| เริ่มใช้งานด้วยบัญชีภายใน | Local username/password และ session cookie; ไม่ใช้ OAuth/SSO เป็น workflow หลัก |
| ปกป้อง PHI | RBAC ฝั่ง server, scoped query และ System Admin แบบ zero-PHI |
| ลดเทคโนโลยี | React/TypeScript/Tailwind + Express/tRPC + MySQL-compatible database/Drizzle |
| รองรับงานคลินิกหลัก | Front Desk, triage/queue, EMR, ยา/สต็อก, billing/payment และรายงาน aggregate |
| ไม่ใช้ข้อมูลเทียม | ไม่ seed หรือ mock ข้อมูลผู้รับบริการ ยา หรือธุรกรรมสำหรับการใช้งาน/UAT |
| รองรับมือถือ | Layout ตามบทบาท, mobile navigation และการทดสอบ regression ของ initial viewport |

## ขอบเขตผลิตภัณฑ์ปัจจุบัน

โมดูลแกนหลักถูกพัฒนาแล้วและอยู่ในสถานะ **พร้อม UAT แบบมีการควบคุม** ได้แก่ local access/staff management, Front Desk/HN, triage/queue, Doctor Console/EMR, medication catalog/inventory, dispensing, Cashier/billing, reports, CSV import และเลขบัตรประชาชนแบบ write-once

งานคงค้างเป็นการรับรองในสภาพแวดล้อมจริงและการตัดสินใจเชิงปฏิบัติการเป็นส่วนใหญ่ โดยเฉพาะ UAT มือถือ, flow ทางการเงิน, เลขบัตรประชาชน, เครื่องอ่าน Smart Card, backup/recovery, incident ownership และ document storage policy

## หลักการที่ห้ามเปลี่ยนโดยไม่มีการอนุมัติ

1. `SYSTEM_ADMIN` ต้องไม่มีเส้นทางเข้าถึง PHI, EMR, diagnosis, รายการยาในระดับ encounter, เลขบัตรประชาชนเต็ม หรือ export ที่ระบุตัวบุคคลได้
2. ทุก query/API/UI ต้องคืนข้อมูลเท่าที่จำเป็นต่อบทบาทและงานนั้น
3. ห้ามสร้าง seed, mock หรือ hardcode ข้อมูลผู้รับบริการ ยา หรือธุรกรรมเพื่อทำให้ระบบดูมีข้อมูล
4. Mutation สำคัญต้องมี audit trail และใช้ transaction/idempotency เมื่อเหมาะสม
5. เลขบัตรประชาชนบันทึกได้ครั้งเดียว, เข้ารหัสเมื่อเก็บ และส่งกลับได้เฉพาะรูปแบบปกปิด
6. Visit ที่แพทย์ลงนามแล้วต้องผ่าน Cashier; ปิด `CLOSED` ได้หลังออก invoice และรับชำระครบเท่านั้น
7. การรับไฟล์ PHI ยังปิดใช้งาน ไม่เปิดโดยไม่มี privacy review และการควบคุมที่อนุมัติ

## แหล่งอ้างอิงหลัก

| หัวข้อ | ไฟล์หลัก |
|---|---|
| สถานะ/ขอบเขตล่าสุด | `docs/project-status-report-th.md` |
| การตัดสินใจสแตก | `docs/ADR-003-minimal-local-auth-stack.md` |
| สิทธิ์และ privacy boundary | `docs/security-model.md` |
| ความพร้อมปฏิบัติการ | `docs/operations-readiness-runbook.md` |
| โครงสร้างข้อมูลจริง | `drizzle/schema.ts` |
| routes และ role navigation | `server/routers.ts`, `client/src/App.tsx`, `client/src/components/DashboardLayout.tsx` |

