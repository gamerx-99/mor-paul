# Security Model: Clinic Mor Phallop HIS

เอกสารนี้กำหนดสิทธิ์ที่ระบบต้องบังคับใช้ในสแตก local username/password โดย frontend มีหน้าที่เพียงแสดงผลตามสิทธิ์ที่ backend ส่งมาเท่านั้น และ **ไม่ใช่แหล่งตัดสินสิทธิ์** การบังคับใช้ต้องเกิดที่ Express/tRPC procedure และ query helper ฝั่ง server ตาม ADR-003

| การกระทำ | แพทย์ | ผู้ช่วย | ผู้ดูแลระบบ |
|---|---:|---:|---:|
| ค้นหา HN และเปิดเวชระเบียนตามหน้าที่ | อนุญาต | อนุญาตแบบจำกัด | ปฏิเสธ |
| อ่าน/เขียน SOAP, diagnosis, allergy และ medication order | อนุญาต | ปฏิเสธ | ปฏิเสธ |
| ลงทะเบียน, triage และจัดคิว | อ่าน | อนุญาต | ปฏิเสธ |
| จ่ายยาและออกบิล | อ่าน | อนุญาตตาม workflow | ปฏิเสธ |
| จัดการผู้ใช้/บทบาท/การตั้งค่าระบบ | ปฏิเสธ | ปฏิเสธ | อนุญาต |
| อ่าน export, audit event ที่เชื่อมโยง PHI หรือ object ใน Storage | ปฏิเสธโดยค่าเริ่มต้น | ปฏิเสธโดยค่าเริ่มต้น | ปฏิเสธ |
| อ่าน audit event ด้าน platform แบบไม่เปิดเผย PHI | ปฏิเสธ | ปฏิเสธ | อนุญาตแบบจำกัด |

> **หลักการสำคัญ:** System Admin จัดการ platform ได้ แต่ต้องไม่มีเส้นทางเข้าถึง PHI, ไฟล์เอกสารผู้ป่วย, diagnosis, รายการยา หรือ export ที่สามารถระบุตัวบุคคลได้

คำสั่งที่เปลี่ยนแปลงข้อมูลสำคัญ เช่น ปิดบิล ตัดสต็อก ลงนามคำสั่งยา เปลี่ยน role และเข้าถึงเอกสาร ต้องแนบ `requestId` และ `idempotencyKey` เมื่อเหมาะสม พร้อมสร้าง audit event ที่เก็บ action, actor, entity, outcome และเวลา โดยไม่คัดลอกเนื้อหาเวชระเบียนลง audit metadata

## เส้นทางข้อมูลที่ยอมรับ

| ข้อมูล | แหล่งบังคับสิทธิ์ | ข้อกำหนดก่อนแสดง/เปลี่ยนข้อมูล |
|---|---|---|
| Patient/Encounter | protected tRPC procedure + scoped database query | ตรวจ local session, role, ความสัมพันธ์ของ encounter และ scoped query |
| EMR/Diagnosis/Medication | protected tRPC procedure + append-only audit | ตรวจ role แพทย์, session, encounter state, signature workflow |
| Queue/Triage | protected tRPC procedure | ผู้ช่วยเขียนเฉพาะ field ที่ได้รับอนุญาต; validate status transition |
| Billing/Stock | protected tRPC procedure + database transaction | idempotency, double-entry/audit, concurrency check |
| Document Storage | ยังไม่เปิดใช้ใน MVP | ต้องกำหนด private storage, type/size validation, scan state และ authorized read ก่อนเปิดใช้ |
| Operational Reports v1 | protected tRPC procedure + aggregate-only database query | อนุญาตเฉพาะช่วงวันไม่เกิน 93 วัน; payload/CSV ห้ามมี HN, ชื่อผู้รับบริการ, visit/invoice identifier, diagnosis, lot number, payment reference หรือ audit event |

> **ขอบเขต Reports v1:** ผู้ใช้ที่ลงชื่อเข้าใช้ทุกบทบาทอ่านได้เฉพาะตัวชี้วัดรวม ได้แก่จำนวน visit, ยอดรับชำระ, หน่วยยาที่จ่าย, stock summary และรายการยาที่จ่ายสูงสุดแบบรวมเท่านั้น โดย SYSTEM_ADMIN ไม่มีเส้นทางไปยัง record ระดับบุคคลหรือรายการยาในระดับ encounter

## Gate ก่อน pilot

ต้องทดสอบ negative cases จาก client ที่ login เป็นแต่ละ role โดยตรง ไม่ใช่เฉพาะปุ่มบนหน้าจอ เช่น ผู้ช่วยอ่าน `diagnosis`, System Admin ดึงไฟล์ที่ path ของผู้ป่วย, token หมดอายุส่งคำสั่งยา และ retry คำสั่งตัดสต็อก หากคำขอใดหลุดผ่าน ให้ถือว่าไม่ผ่าน gate

## ขอบเขตปัจจุบัน

ระบบยังไม่มีข้อมูลผู้ป่วยหรือ seed data การเพิ่ม table/procedure ใดในระยะ Front Desk ต้องเริ่มเป็นข้อมูลว่างและสร้าง record เฉพาะจากการส่งแบบฟอร์มของผู้ใช้ที่ผ่าน authorization แล้วเท่านั้น
