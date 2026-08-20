# Clinic Workflow

## สถานะหลัก

`REGISTERED` → `TRIAGED` → `WAITING_DOCTOR` → `IN_CONSULT` → `DISPENSING`/`BILLED` → `CLOSED`

สถานะ `CANCELLED` ใช้สำหรับยกเลิกรายการตาม workflow ที่ server อนุญาต สถานะจริงต้องเปลี่ยนผ่าน procedure/transaction ฝั่ง server ไม่ใช่จาก UI เพียงอย่างเดียว

## ขั้นตอนปฏิบัติงาน

| ขั้น | ผู้ดำเนินการหลัก | สิ่งที่ทำ | ผลลัพธ์/ข้อบังคับ |
|---|---|---|---|
| 1. ลงทะเบียน | ASSISTANT | ค้นหา HN หรือสร้าง patient/visit | สร้าง visit ในสถานะ `REGISTERED`; ไม่ใช้ข้อมูลตัวอย่าง |
| 2. บันทึกเลขบัตร (ถ้ามี) | ASSISTANT | กรอกเองหรือรับจาก local Smart Card Bridge | validate checksum, เก็บได้ครั้งเดียว, แสดงแบบ masked-only |
| 3. Triage | ASSISTANT | บันทึก vital, triage note และ urgency | สร้าง/ปรับ triage record ตามสิทธิ์ |
| 4. Queue | ASSISTANT/DOCTOR | จัดคิว และแพทย์เรียกคิวตาม workflow | queue status ถูกเปลี่ยนตาม state transition |
| 5. ตรวจรักษา | DOCTOR | SOAP draft, diagnosis, medication order | sign encounter เพื่อยืนยัน clinical record |
| 6. จ่ายยา | ASSISTANT | จ่ายยาจาก signed order, ใช้ FEFO lot | เกิด dispensation และ stock movement ที่ตรวจสอบย้อนกลับได้ |
| 7. บันทึกค่าบริการ | ASSISTANT | เพิ่มชื่อบริการ รายละเอียด จำนวน และราคาต่อหน่วย | service charge แยกจาก medication order โดยเด็ดขาด |
| 8. ออกบิล | ASSISTANT | สร้าง invoice รวม line items ยา/บริการ | มีได้แม้ไม่มีรายการยา; line source แยกชัดเจน |
| 9. รับชำระ | ASSISTANT | บันทึก payment พร้อม idempotency | รับชำระสำเร็จครบแล้วเท่านั้นจึงปิด visit ได้ |

## กฎ Cashier ที่ห้ามละเมิด

> Encounter ที่แพทย์ลงนามแล้วต้องเข้าสู่ Cashier ทุกครั้ง แม้ไม่มีการสั่งยา และ visit จะเป็น `CLOSED` ได้ต่อเมื่อสร้าง invoice และรับชำระสำเร็จครบตามยอดแล้ว

ค่ายาและค่าบริการเป็นคนละ domain: ยาต้องอิง signed medication order/dispensation/stock movement ส่วนค่าบริการเป็น `serviceCharges` ที่ผู้ช่วยบันทึก รายการทั้งสองถูก snapshot ลง `invoiceLines` เพื่อเก็บราคาและคำอธิบายในเวลาที่ออกบิล

## Smart Card Workflow ที่มีอยู่

1. ผู้ช่วยเป็นผู้เริ่มการอ่านบัตรจากหน้าที่ได้รับสิทธิ์
2. Browser เรียก Local Smart Card Bridge ที่เครื่องคลินิกตาม contract ที่เตรียมไว้
3. Bridge ส่งกลับเฉพาะข้อมูลเท่าที่ contract อนุญาต; ไม่ log เลขบัตรเต็ม
4. หาก bridge/อุปกรณ์ไม่พร้อม ผู้ช่วยกรอกเลขด้วยมือและผ่าน checksum validation
5. หลังบันทึก ระบบล็อกข้อมูลเป็น write-once และแสดงได้เฉพาะ `12••••••••345`

การเปิดใช้งานขั้นตอนนี้กับเครื่องจริงยัง **Blocked** จนกว่าจะทราบรุ่นเครื่องอ่าน, OS และ driver

