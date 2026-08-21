# Clinic HIS — UAT Checklist

>  ใช้สำหรับทดสอบก่อน pilot  
>  ห้ามใส่ PHI ใน任何หลักฐาน

## P1 — Core Workflow

### P1-01 Mobile Bottom Navigation
- [ ] DOCTOR: เมนูแสดงครบ  first load, hard refresh, direct route, back-navigation
- [ ] ASSISTANT: เมนูแสดงตามสิทธิ์ ไม่มีเมนู role อื่นโผล่
- [ ] ทดสอบบน mobile viewport (≤768px)

### P1-02 Cashier With Medication
- [ ] Sign encounter → dispense → service charge → invoice → full payment → CLOSED
- [ ] ยอดจ่ายตรงกับยอดใบแจ้งหนี้
- [ ] ไม่สามารถปิด visit ข้าม invoice/payment

### P1-03 Cashier Without Medication
- [ ] Sign encounter → service charge → invoice → full payment → CLOSED
- [ ] ไม่บังคับ dispense

### P1-04 National ID
- [ ] Checksum ถูกต้อง
- [ ] Uniqueness ไม่ซ้ำ
- [ ] Write-once ไม่แก้ไขได้
- [ ] UI/API แสดง masked value

### P1-05 RBAC / Negative Cases
- [ ] ทุก role ถูกปฏิเสธเมื่อเรียก resource ที่ไม่ควรเข้าถึง
- [ ] SYSTEM_ADMIN เห็น zero-PHI overview

## P3 — Pilot Gate

### P3-01 UAT Review
- [ ] ไม่มี critical defect ด้าน PHI, RBAC, audit, idempotency
- [ ] หากมี mitigation ต้องอนุมัติแล้ว

### P3-02 Checkpoint
- [ ] `pnpm check` ผ่าน
- [ ] `pnpm test` ผ่าน
- [ ] `pnpm build` สำเร็จ
- [ ] บันทึก version ID

### P3-03 Go/No-go
- [ ] ผู้รับผิดชอบยืนยันเกณฑ์ครบ
- [ ] บันทึก decision + วันที่

## How to Record Evidence

ใช้ `docs/uat-verification-evidence.md` เก็บหลักฐาน แต่ละ cases:
- วันที่ทดสอบ
- บัญชี role ที่ใช้
- ผล: ผ่าน / ไม่ผ่าน + หมายเหตุ
-  ไม่แนบ screenshot ที่มี PHI
