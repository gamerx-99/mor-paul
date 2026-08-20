# รายงานความเข้ากันได้ของ UI อ้างอิงกับ Clinic HIS

**ขอบเขตการประเมิน:** ชุด `stitch_his_dashboard.zip` เทียบกับ Clinic HIS สถานะปัจจุบัน ณ โมดูล Front Desk, ทะเบียน HN, triage และ queue

## ข้อสรุป

UI ที่อัปโหลด **เข้ากันได้ในฐานะ visual and interaction reference** กับทิศทางของ Clinic HIS โดยเฉพาะหน้าคัดกรองและคิว ซึ่งใช้แนวคิดเดียวกันคือแสดงรายการคิวทางซ้ายและพื้นที่ทำงานของผู้รับบริการที่เลือกทางขวา สี teal/green/cream และฟอนต์ Sarabun/Kanit ก็กลมกลืนกับแนว Clinical Transit Board ที่วางไว้แล้ว

อย่างไรก็ตาม ชุดที่อัปโหลดเป็น HTML แบบ static ที่พึ่งพา Tailwind CDN และมีข้อมูลผู้รับบริการ ยา จำนวนเงิน และสถิติคิวสาธิตฝังอยู่ จึง **ไม่ควรนำ HTML หรือข้อมูลภายในไปใช้โดยตรง** ต้องสร้างใหม่เป็น React + TypeScript + Tailwind ของโครงการ และ bind เฉพาะข้อมูลจริงผ่าน tRPC เท่านั้น

## ตารางความเข้ากันได้

| พื้นที่ UI | ความเข้ากันได้ | สิ่งที่ระบบมีแล้ว | สิ่งที่ต้องทำก่อนใช้งานจริง |
| --- | --- | --- | --- |
| Design system | สูง | Tailwind 4, shadcn/ui, DashboardLayout และแนวสี clinical ที่สอดคล้อง | แปลง token สี, spacing และ typography เป็น CSS/theme ของโครงการ แทน Tailwind CDN |
| Queue board | สูง | `queueEntries`, `visits`, patient lookup, `frontDesk.listQueue`, `frontDesk.callNext` | สร้าง React page ที่มี loading/empty/error state และ action ตามบทบาท |
| Triage | สูง | vital signs, urgency, triage note, allergy summary, patient/visit/queue records และ `frontDesk.recordTriage` | สร้างฟอร์มจริง, แยก chief complaint ของ visit ออกจาก triage note, บันทึก mutation และ refresh queue |
| Patient header | สูง | HN, ชื่อ, วันเกิด, เพศ, allergy summary และ vital signs ล่าสุด | คำนวณอายุใน UI, แสดง allergy เฉพาะเมื่อมีค่าจริง และไม่แสดง PHI ให้ SYSTEM_ADMIN |
| Local authentication | ปานกลาง | local username/password, httpOnly session และ RBAC server-side | เปลี่ยน header/profile/navigation ของ UI อ้างอิงให้ใช้ `useAuth()` และ local logout |
| Role-based navigation | ปานกลาง | `ASSISTANT`, `DOCTOR`, `SYSTEM_ADMIN` และ role-specific procedures | ซ่อนเมนูตาม role และป้องกัน route ฝั่ง client ควบคู่กับการบังคับ server-side ที่มีอยู่แล้ว |
| System Config | ปานกลาง | หลัก zero-PHI และ audit event schema | ต้องพัฒนา user/master-data/audit procedures; หน้าดังกล่าวต้องไม่มีชื่อ HN หรือ patient header |
| Doctor Console / EMR | ต่ำในระยะนี้ | visit, triage และ doctor call-next เป็นฐานข้อมูลต้นน้ำ | ต้องเพิ่ม clinical notes, diagnosis, order, medication/procedure, history และ file storage ก่อนเปิดใช้งาน |
| Cashier / Pharmacy | ต่ำในระยะนี้ | ยังไม่มี data model ทางยา การเงิน หรือคลัง | ต้องเพิ่ม drug master, stock ledger, prescription, invoice/payment, printing และ audit workflow |

## ความสอดคล้องกับสิทธิ์และข้อมูลจริง

หน้า **Triage** เหมาะกับบทบาท `ASSISTANT` เพราะขั้นตอนลงทะเบียน สร้าง visit และบันทึก vital signs มี procedure ที่จำกัดสิทธิ์ดังกล่าวอยู่แล้ว ส่วน `DOCTOR` ควรเห็นข้อมูลคิวและสามารถเรียกคิวถัดไปตาม procedure ที่มีอยู่ แต่ไม่ควรได้รับปุ่มแก้ไข triage แบบเดียวกับผู้ช่วย

หน้า **System Config** แยกออกจากข้อมูลคลินิกได้อย่างเหมาะสมในเชิง visual แต่ต้องคงข้อกำหนดสำคัญว่า `SYSTEM_ADMIN` ไม่มี route หรือ API ที่คืนชื่อ HN ข้อมูลแพ้ยา หรือรายละเอียด visit ทั้ง UI และ server-side guard ต้องยึดหลักนี้พร้อมกัน

ภาพและ HTML อ้างอิงประกอบด้วยชื่อผู้รับบริการ HN อาการ/ประวัติแพ้ยา รายการยา ราคา จำนวนเงิน และจำนวนคิวตัวอย่าง สิ่งเหล่านี้จะไม่ถูกคัดลอกเป็น code, fixture, mock, seed หรือ database record ของ Clinic HIS แนวทางที่ถูกต้องคือหน้าจอเริ่มต้นต้องแสดง empty state จนกว่าผู้ใช้งานจะบันทึกข้อมูลจริงผ่าน workflow

## ข้อเสนอการนำไปใช้

ในระยะ Front Desk ปัจจุบัน ควรนำมาใช้เฉพาะภาษาภาพของ **Triage + Queue Board** ได้แก่ sidebar แบบ clinical workbench, patient summary, allergy alert เฉพาะกรณีมีข้อมูลจริง, ฟอร์ม vital signs แบบ touch-friendly และป้ายสถานะคิว ขณะเดียวกันให้คง `DashboardLayout` ของโครงการเป็น shell หลัก เพื่อรับ local session, เมนูตามบทบาท และ logout ที่มีอยู่

ส่วน Doctor Console, Pharmacy/Cashier และ System Config ควรคงเป็นเป้าหมาย UI ระยะถัดไป โดยสามารถเตรียม route placeholder ที่ไม่มี PHI ได้ แต่ไม่ควรเปิดปุ่มบันทึกหรือคัดลอกตัวเลข/ข้อมูลตัวอย่างจนกว่า schema, procedure, RBAC, audit trail และการทดสอบของโมดูลนั้นจะพร้อม

> **คำตัดสิน:** รับ UI ชุดนี้เป็นแนวทางการออกแบบได้ แต่ต้อง reimplement ตามสแตกและข้อบังคับความปลอดภัยของ Clinic HIS ไม่ใช่ import หรือแปลง HTML static ตรง ๆ
