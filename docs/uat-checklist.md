# UAT Checklist — Clinic Mor Phallop HIS

เอกสารนี้ใช้บันทึกผลการทดสอบของเจ้าของคลินิกกับข้อมูลที่คลินิกมีสิทธิ์ใช้จริงเท่านั้น ระบบจะไม่สร้างข้อมูลจำลองเพื่อทำให้รายการใดผ่าน ผู้ทดสอบห้ามบันทึกชื่อ, HN, วันเกิด, อาการ, SOAP, diagnosis, รายการยา, ยอดเงิน หรือภาพหน้าจอที่มี PHI ลงในเอกสารนี้ ให้บันทึกเพียง **ผ่าน/ไม่ผ่าน, เวลา, บทบาท, request ID ที่อนุญาต และหมายเลข incident ที่ไม่เปิดเผย PHI**

> ก่อนเริ่ม: อ่าน `operations-readiness-runbook.md`, ตั้งผู้รับผิดชอบ, ยืนยัน backup decision และใช้ environment ที่ Clinic system owner อนุมัติ

## ข้อมูลรอบการทดสอบ

| รายการ | ผู้บันทึก |
|---|---|
| รหัสรอบ UAT |  |
| วันที่/ช่วงเวลา |  |
| Environment |  |
| Clinic system owner |  |
| ตัวแทน SYSTEM_ADMIN / DOCTOR / ASSISTANT |  |
| Backup decision / recovery drill reference |  |
| Checkpoint version |  |

## A. Identity, security และ role boundary

| ID | บทบาทผู้ทดสอบ | ขั้นตอน | ผลที่คาดหวัง | ผ่าน/ไม่ผ่าน | หมายเหตุไม่ใส่ PHI |
|---|---|---|---|---|---|
| A-01 | SYSTEM_ADMIN | ลงชื่อเข้าใช้ด้วยบัญชีจริงที่ได้รับอนุมัติ | เข้า Staff Management และ Medication Catalog ได้ |  |  |
| A-02 | SYSTEM_ADMIN | พยายามเข้าหน้า Front Desk, Queue, Doctor Console และ Cashier | ถูกปฏิเสธ; ไม่มีรายชื่อ/HN/visit/invoice แสดง |  |  |
| A-03 | DOCTOR | ลงชื่อเข้าใช้และเปิด Doctor Console | เข้าถึงเฉพาะงานตรวจที่ workflow อนุญาต |  |  |
| A-04 | ASSISTANT | ลงชื่อเข้าใช้และเปิด Front Desk/Queue/Cashier | เข้าถึงงานทะเบียน คิว จ่ายยา และรับชำระตาม role |  |  |
| A-05 | บุคลากร | เปลี่ยน password ด้วย password ปัจจุบันที่ถูกต้อง | เปลี่ยนสำเร็จ, session อื่นของบัญชีถูกเพิกถอน |  |  |
| A-06 | บุคลากร | ใช้ password ปัจจุบันที่ไม่ถูกต้องเพื่อเปลี่ยน password | ถูกปฏิเสธโดยไม่เปิดเผย secret |  |  |
| A-07 | บุคลากร | ให้ session หมดอายุ/ถูกเพิกถอนตามขั้นตอนที่ owner อนุมัติ | กลับ AccessGate, PHI cache ถูกล้าง, sign-in ใหม่แล้วทำงานต่อได้ |  |  |
| A-08 | บุคลากร | ทำ sign-in ผิดซ้ำตามเกณฑ์ | ข้อความกลาง, การลองถูกจำกัด, ไม่มี account enumeration |  |  |

## B. Clinical-to-cashier workflow

| ID | บทบาทผู้ทดสอบ | ขั้นตอน | ผลที่คาดหวัง | ผ่าน/ไม่ผ่าน | หมายเหตุไม่ใส่ PHI |
|---|---|---|---|---|---|
| B-01 | ASSISTANT | ค้นหา HN/ลงทะเบียนผู้รับบริการที่คลินิกอนุญาต | ไม่มี record ซ้ำ และมี audit event |  |  |
| B-02 | ASSISTANT | สร้าง visit และบันทึก triage | สถานะ visit/queue เปลี่ยนตาม contract |  |  |
| B-03 | DOCTOR | รับคิว, บันทึก SOAP/draft, diagnosis และ medication order | เฉพาะ DOCTOR แก้ไข clinical data ได้; revision conflict ถูกป้องกัน |  |  |
| B-04 | SYSTEM_ADMIN | เพิ่ม catalog, active price และรับ inventory lot ที่คลินิกมีสิทธิ์ใช้ | ทำได้โดยไม่เห็น visit หรือข้อมูลผู้รับบริการ |  |  |
| B-05 | ASSISTANT | จ่ายยาจากคำสั่งที่ลงนามแล้ว | ใช้ lot ตาม stock rule; replay ไม่สร้าง dispense ซ้ำ |  |  |
| B-06 | ASSISTANT | รับชำระตาม invoice ที่ระบบสร้าง | ยอดตรงกับ invoice; replay ไม่สร้าง payment ซ้ำ |  |  |
| B-07 | ผู้ทดสอบที่ได้รับอนุมัติ | ตรวจ audit event ที่เกี่ยวข้อง | actor, role, action, request ID และ outcome มี; ไม่มี secret/PHI เกินจำเป็น |  |  |

## C. Operational readiness และ recovery

| ID | ผู้รับผิดชอบ | ขั้นตอน | ผลที่คาดหวัง | ผ่าน/ไม่ผ่าน | หมายเหตุไม่ใส่ PHI |
|---|---|---|---|---|---|
| C-01 | Backup custodian | ตรวจสถานะ backup/owner ตาม runbook | มี backup decision และหลักฐาน package ที่รักษาปลอดภัย |  |  |
| C-02 | Backup custodian + incident lead | ทำ recovery drill ใน non-production environment | ตรวจตาม runbook โดยไม่ restore ทับ production |  |  |
| C-03 | Change owner | ตรวจ version checkpoint, `pnpm check`, `pnpm test`, `pnpm build` | ผลผ่านและ version ระบุได้ |  |  |
| C-04 | Incident lead | จำลองเหตุการณ์บัญชีเสี่ยงหรือระบบไม่พร้อมใช้โดยไม่ใช้ PHI | ทีมทำตาม incident matrix และบันทึกเฉพาะ metadata |  |  |

## Acceptance และ issue log

การยอมรับ UAT ต้องมี C-01 ถึง C-04 ผ่าน และไม่มี critical defect ใน RBAC, PHI exposure, audit หรือ idempotency เจ้าของคลินิกกำหนดการยอมรับอย่างชัดเจนก่อน pilot ข้อบกพร่องต้องบันทึกด้วยรหัส issue, category, severity, owner, checkpoint ที่พบ และสถานะเท่านั้น ห้ามใส่ PHI หรือ secret ใน issue log

| ผลรวม | Clinic system owner | Incident lead | วันที่ |
|---|---|---|---|
| ผ่าน / ไม่ผ่าน / ผ่านแบบมีเงื่อนไข |  |  |  |
