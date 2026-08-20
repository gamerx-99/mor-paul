# บันทึกการตรวจ UI ที่อัปโหลด

## ขอบเขตที่ตรวจแล้ว

ไฟล์ `stitch_his_dashboard.zip` เป็นชุด HTML แบบ static พร้อมภาพตัวอย่างสำหรับหน้า dashboard, triage, doctor console, cashier และ system configuration โดยอ้างอิง Tailwind CDN และ Google Fonts แทน React component หรือ API contract ที่เชื่อมระบบจริง

## ข้อค้นพบเชิงภาพและโครงสร้าง

| องค์ประกอบ | ข้อค้นพบ | ผลต่อ Clinic HIS |
| --- | --- | --- |
| ธีม | ใช้ teal, sage, cream, Sarabun/Kanit, card ขอบโค้ง และ layout แบบ sidebar หรือ top navigation | เข้ากับแนว Clinical Transit Board เดิม สามารถถ่ายทอดเป็น Tailwind token/component ได้ |
| Triage | มี queue list, patient header, allergy alert และฟอร์ม weight/height/BP/temperature/chief complaint | สอดคล้องกับตาราง `patients`, `visits`, `triageRecords`, `queueEntries` ที่สร้างแล้ว แต่ต้อง bind กับ procedure จริงและแสดงเฉพาะบทบาท ASSISTANT |
| System Config | แยกหน้าจอ config และ master data ออกจากงานคลินิก | สอดคล้องกับหลัก SYSTEM_ADMIN ไม่เข้าถึง PHI หากไม่มี patient header หรือชื่อผู้รับบริการในเส้นทางนี้ |
| ข้อมูลตัวอย่าง | ภาพและ HTML มีชื่อ HN ประวัติแพ้ยา จำนวนคิว และรายการยาตัวอย่าง | ต้องไม่นำข้อมูลเหล่านี้ไปใช้ในโค้ดหรือ seed ฐานข้อมูล ตามข้อกำหนดข้อมูลจริงเท่านั้น |
| Doctor Console | มี SOAP, diagnosis ICD-10, medication/procedure orders, history timeline และไฟล์เอกสาร | เป็น target UX ของระยะ EMR แต่ยังไม่มีตาราง/procedure สำหรับ clinical note, diagnosis, orders, visit history หรือ private file storage |
| Cashier | มีรายการที่แพทย์สั่ง, ราคายา/บริการ, ชำระเงิน, QR, เงินทอน และการพิมพ์ | เป็น target UX ของระยะ dispensing/finance แต่ยังไม่มี master drug, stock, order, invoice, payment หรือ print workflow ในระบบ |

## ประเด็นที่ต้องตรวจเพิ่ม

หน้าจอที่อัปโหลดยังไม่ประกอบด้วย role-aware routing, local username/password session, tRPC calls, audit trail, loading/empty/error states หรือการบังคับ RBAC ฝั่ง server จึงใช้เป็น visual reference ได้ แต่ไม่ควรนำ HTML ไปวางทับโครงการโดยตรง

Doctor Console และ Cashier มีข้อความ ชื่อผู้รับบริการ ผลตรวจ รายการยา และจำนวนเงินตัวอย่างในภาพ ซึ่งต้องไม่ถูกย้ายเข้า source code, fixture หรือฐานข้อมูลของโครงการ
