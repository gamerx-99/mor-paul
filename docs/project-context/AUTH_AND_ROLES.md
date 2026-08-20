# Authentication and Roles

## Authentication Model

ระบบใช้ **local username/password** เป็นช่องทางเข้าใช้หลัก ไม่เปลี่ยนเป็น OAuth/SSO โดยไม่มีการอนุมัติทางโครงการ

| หัวข้อ | การทำงานที่มีอยู่ |
|---|---|
| Bootstrap | สร้าง `SYSTEM_ADMIN` คนแรกได้ครั้งเดียวโดยใช้ `INITIAL_SETUP_KEY` จาก secret ฝั่ง server |
| Username | normalize และ validate ความยาว 3–32 ตัวอักษรตาม policy |
| Password | เก็บ scrypt hash; password input รับ 12–128 ตัวอักษร |
| Password policy | ขั้นต่ำ 12 ตัวอักษร; หากสั้นกว่า 16 ต้องมีอย่างน้อย 3 ประเภทอักขระตาม server policy; UI มี strength guidance |
| Session | opaque random token ใน `httpOnly` cookie; DB เก็บ SHA-256 hash; TTL 8 ชั่วโมง |
| Session control | logout, revoke เมื่อบัญชีปิดใช้งาน/เปลี่ยนรหัสผ่าน และ SessionExpiryBoundary ฝั่ง UI |
| Login protection | failed-login tracking/lock state ใน schema และ server-side login rate limiting |

## Server-side authorization

frontend แสดง navigation ตาม role เพื่อ UX เท่านั้น การอนุญาตต้องถูกตรวจที่ Express/tRPC procedure และ query helper ฝั่ง server มี procedure boundary หลัก ได้แก่ `publicProcedure`, `protectedProcedure`, `assistantProcedure`, `doctorProcedure`, `adminProcedure` และ procedure อ่าน medication catalog สำหรับ role ที่ได้รับอนุญาต

## Role Matrix

| Capability | SYSTEM_ADMIN | DOCTOR | ASSISTANT |
|---|---:|---:|---:|
| Platform/staff account management | อนุญาต | ปฏิเสธ | ปฏิเสธ |
| Medication catalog, price, inventory lot | อนุญาต | อ่าน catalog ตามงาน | อ่าน catalog ตามงาน/dispense ตาม workflow |
| Patient registration/HN/visit | ปฏิเสธ | อ่านตามหน้าที่ | อนุญาต |
| Triage และ queue update | ปฏิเสธ | อ่าน/เรียกคิวตาม workflow | อนุญาต |
| SOAP, diagnosis, medication order, sign encounter | ปฏิเสธ | อนุญาต | ปฏิเสธ |
| Dispensing, service charge, invoice, payment | ปฏิเสธ | อ่านตาม workflow | อนุญาต |
| Aggregate reports | อนุญาตแบบ zero-PHI | อนุญาตแบบ aggregate | อนุญาตแบบ aggregate |
| PHI / clinical note / full national ID | **ปฏิเสธ** | ตามหน้าที่ clinical | เฉพาะส่วนที่จำเป็นต่อ Front Desk/Billing; ไม่อ่าน EMR |

## กฎสำคัญของ SYSTEM_ADMIN

`SYSTEM_ADMIN` มีสิทธิ์ดูแล platform, staff และ catalog แต่ต้องไม่มี route/procedure/query ที่คืน PHI, patient-level record, clinical note, diagnosis, encounter-level medications, full national ID หรือ export ที่ระบุตัวบุคคลได้

## Test Gate

ก่อน pilot ต้องทดสอบ deny paths จาก client ที่ login เป็นแต่ละ role โดยตรง ไม่ใช่ทดสอบเฉพาะการซ่อนปุ่ม เช่น ASSISTANT เรียกอ่าน diagnosis, SYSTEM_ADMIN เรียก PHI/file path, token หมดอายุส่งคำสั่งยา และ retry mutation ด้านสต็อก

