# Known Issues and Technical Debt

## Open Confirmed Bugs

จากหลักฐานในโครงการ ณ วันที่จัดทำเอกสารนี้ **ไม่มี bug ที่ยืนยันว่าเปิดค้างอยู่ใน source code** อย่างไรก็ตาม การไม่มี bug ที่ระบุไว้ไม่เท่ากับผ่าน UAT ในสภาพแวดล้อมจริง

## Fixed Issue Requiring Real-device Validation

| Issue | สถานะโค้ด | สิ่งที่ยังต้องยืนยัน |
|---|---|---|
| Mobile Bottom Navigation / initial mobile navigation display ไม่ถูกต้องใน first render | Fixed | ทดสอบบนโทรศัพท์จริงของ DOCTOR และ ASSISTANT: hard refresh, direct entry, กลับหน้า, กดเมนูทุกตัวที่ role อนุญาต |

root cause ที่มีหลักฐานคือ mobile viewport hook เริ่มต้นด้วยค่าไม่สะท้อน `window.innerWidth` จนหลัง effect; การแก้ใช้ initial state ที่อ่าน viewport ทันที และเพิ่ม regression tests โดยไม่เปลี่ยน routing/navigation logic/callback หรือ desktop layout

## Technical Debt และข้อจำกัดที่ตั้งใจไว้

| หัวข้อ | สถานะ | ความเสี่ยง/ผลกระทบ | เงื่อนไขก่อนทำต่อ |
|---|---|---|---|
| Smart Card hardware integration | Blocked | bridge boundary มีแล้ว แต่ไม่มีผลทดสอบอุปกรณ์จริง | ระบุ reader model, OS, driver และตั้งค่า local bridge |
| Backup/recovery evidence | Pending | ไม่ควรเปิด pilot หากไม่มี recovery drill | owner, backup package policy และ drill บน non-production |
| Incident ownership/monitoring | Pending | การตอบสนองเหตุขัดข้องอาจไม่ชัดเจน | แต่งตั้ง incident lead และเริ่มบันทึก manual monitoring ที่ไม่เก็บ PHI |
| File/document upload | Disabled by design | ไม่รองรับ consent/ID copy/lab file ในระบบ | privacy review และ controls สำหรับ storage/validation/retention/restore |
| Production UAT evidence | Pending | โค้ดผ่าน test แต่ยังไม่มี proof ครบทุก workflow/role ในคลินิก | ดำเนิน UAT checklist โดยไม่ใส่ PHI |

## สิ่งที่ไม่ควรตีความเป็น bug

1. ระบบเริ่มด้วย empty state และไม่มี patient/medication/transaction seed data เป็นข้อกำหนด ไม่ใช่ข้อมูลหาย
2. `SYSTEM_ADMIN` ไม่เห็นข้อมูลผู้รับบริการหรือ EMR เป็น privacy boundary ไม่ใช่สิทธิ์ตกหล่น
3. การไม่มี upload file เป็น scope ที่ปิดไว้โดยเจตนา ไม่ใช่ฟังก์ชันเสีย
4. Smart Card ใช้ manual entry fallback ก่อน integration กับอุปกรณ์จริง เป็นแนวทางปลอดภัย ไม่ใช่ direct reader support ที่ขาดหายโดยบังเอิญ

