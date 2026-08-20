# ADR-001: เลือก backend สำหรับข้อมูลและคำสั่งที่มีสิทธิ์สูง

**สถานะ:** อนุมัติแบบมีเงื่อนไขสำหรับการพัฒนาต่อ

## บริบท

ระบบมีข้อมูลสุขภาพ การเงิน สต็อก และเอกสารยินยอม จึงต้องบังคับใช้การยืนยันตัวตน สิทธิ์แบบละเอียด และ audit trail ที่ตรวจสอบย้อนหลังได้ ไม่เพียงซ่อนเมนูฝั่ง client เท่านั้น Blueprint เดิมกำหนด React + Firebase + Google Apps Script (GAS) เป็นสแต็กตั้งต้น และอนุญาตให้เปลี่ยน privileged backend หาก feasibility gate ไม่ผ่าน

## ผล feasibility gate

Firebase แนะนำการตรวจ Firebase ID token ด้วย Firebase Admin SDK ซึ่งตรวจรูปแบบ ลายเซ็น และอายุของ token โดยอาศัย project ID และ credential ของ server [1] การตรวจ token แบบนั้นไม่ได้ครอบคลุมการ revoke token โดยอัตโนมัติ [1] ขณะเดียวกัน Apps Script มี runtime สูงสุด 6 นาทีต่อ execution และ quota/limit อาจเปลี่ยนแปลงได้ โดยเกิน quota แล้ว execution อาจหยุดด้วย exception [2]

สำหรับระบบที่ต้องเก็บข้อมูลสุขภาพ จึงไม่ควรวาง privileged operation ไว้บน GAS เพียงอย่างเดียวโดยยังไม่มีการทดสอบ token-verification, service-account custody, role enforcement, idempotency และ auditability บน Firebase project จริง ไม่มีหลักฐานเพียงพอในโครงการนี้ที่ยืนยันว่า GAS bridge จะบังคับ zero patient-data access ของ System Admin และรองรับ workflow การเงิน/สต็อกได้อย่างปลอดภัย

## การตัดสินใจ

เลือก **สถาปัตยกรรม B** สำหรับ production path ดังนี้: React/Tailwind SPA ใช้ Firebase Authentication สำหรับ identity; Firestore และ Cloud Storage บังคับสิทธิ์ด้วย Security Rules และ custom claims; งาน privileged เช่น การออกเลขเอกสาร การเปลี่ยนสถานะที่มีผลต่อการเงิน/สต็อก การสร้าง audit event และการอัปโหลดที่ต้องตรวจละเอียด อยู่ใน Cloud Functions หรือ Cloud Run ซึ่งจัดการ service identity แยกจาก frontend ได้

GAS สามารถคงไว้สำหรับงานธุรการที่ไม่เข้าถึง PHI โดยตรง เช่น export รายงานที่ผ่านการ mask/aggregate แล้ว หรืองานแจ้งเตือนที่ผ่าน privileged backend เป็นตัวกลาง ห้ามเก็บหรือประมวลผล password ใน GAS หรือ Firestore

## ขอบเขตที่ต้องพิสูจน์ก่อนใช้จริง

| ประเด็น | เกณฑ์ยอมรับ |
|---|---|
| Firebase Auth | ผู้ใช้สามบทบาท login/logout, token expiry, disable user และ refresh role ได้; backend ปฏิเสธ token หมดอายุ/ไม่ถูกต้อง |
| RBAC | ผู้ช่วยอ่าน SOAP/diagnosis ไม่ได้ และ IT Admin อ่าน PHI, export, logs หรือ Storage object ไม่ได้ ทั้งจาก UI และ direct request |
| Integrity | คำสั่งสำคัญใช้ transaction หรือ idempotency key; บิล/ตัดสต็อกซ้ำจาก retry ไม่ได้ |
| Audit | การอ่าน/แก้ไข/ลงนาม EMR, คำสั่งยา, การเงิน, stock, เอกสาร และเปลี่ยน role สร้าง audit event ที่ไม่บันทึก PHI เกินจำเป็น |
| Storage | ตรวจ type/size, ไม่มี public URL, path ผูกกับ patient/encounter/ประเภทเอกสาร, และการเปิดไฟล์ต้องผ่าน authorization |
| Recovery | ทดสอบ backup และ restore ใน Firebase project แยกจาก production ก่อน pilot |

## ผลต่อ frontend ใน repository นี้

frontend จะใช้ interface ของ data adapter แยกจากหน้าจอ และไม่มี Firebase private credential, service-account JSON, หรือ PHI อยู่ใน source control การแสดงข้อมูลชุดต้นแบบใช้เฉพาะข้อมูลสังเคราะห์และต้องถูกแทนที่ด้วย data adapter จริงหลัง provision environment

## References

[1]: https://firebase.google.com/docs/auth/admin/verify-id-tokens "Firebase Authentication: Verify ID Tokens"
[2]: https://developers.google.com/apps-script/guides/services/quotas "Google Apps Script: Quotas for Google Services"
