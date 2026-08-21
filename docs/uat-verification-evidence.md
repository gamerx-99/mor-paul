# Authenticated Role Verification

## SYSTEM_ADMIN — 20 August 2026

เข้าสู่ระบบผ่านหน้า AccessGate ด้วยบัญชีทดสอบที่ provision จากบัญชีบุคลากรจริงเรียบร้อยแล้ว และตรวจหน้า Home ใน browser preview

| รายการตรวจสอบ | ผล |
|---|---|
| สถานะการเข้าสู่ระบบ | ผ่าน — แสดงบทบาท `PLATFORM / ZERO-PHI` |
| การเรียกหรือแสดงคิว | ไม่พบ — หน้า Home ระบุชัดว่าไม่เรียกหรือแสดงคิว/ข้อมูลผู้รับบริการ/เวชระเบียน |
| เมนูที่เห็น | คลังยาและราคา, รายงานสรุป, บัญชีบุคลากร |
| เมนู clinical | ไม่ปรากฏ |
| ข้อมูลรายบุคคล | ไม่ปรากฏ |

หลักฐานนี้ตรวจด้วยบัญชีระบบจริงที่ไม่มีข้อมูลผู้ป่วย ยา หรือธุรกรรมเพิ่มขึ้นระหว่างการทดสอบ
# Authenticated Role Verification — DOCTOR

วันที่ตรวจ: 20 สิงหาคม 2569

## ผลการยืนยัน

บัญชีทดสอบบทบาท **DOCTOR** เข้าสู่ระบบผ่านได้หลังรีเซ็ตรหัสผ่านและตั้งค่าให้บังคับเปลี่ยนรหัสผ่านในการใช้งานครั้งต่อไป ระบบนำไปยังหน้า **Clinical Transit Board** ซึ่งแสดงเฉพาะสถานะคิวจริงของวันนั้น โดยผลรวมทุกสถานะเป็น `0` และแสดง empty state ว่าไม่มีคิวที่ต้องดำเนินการ

## ขอบเขตที่ตรวจพบ

| รายการ | ผล |
|---|---|
| การยืนยันตัวตน | ผ่าน |
| บทบาทบนหน้าจอ | DOCTOR |
| สถานะคิวจริง | ไม่มีรายการคิว |
| ปุ่ม workflow | เรียกคิวถัดไป, รีเฟรช, เปิด Queue Board |
| ข้อมูลผู้รับบริการจำลอง | ไม่มี |

การทดสอบนี้ยืนยันเพียง empty-state และจุดเริ่มต้น workflow ตามสิทธิ์ DOCTOR; การทดสอบที่มีผู้รับบริการจริงต้องทำตาม UAT checklist โดยผู้ใช้ที่ได้รับอนุญาต

หลังการตรวจ ระบบ logout session ของ DOCTOR ผ่าน `auth.logout` สำเร็จ เพื่อป้องกันการคง session ข้ามการตรวจบทบาทถัดไป
# Pharmacy UI Verification Notes

ตรวจเมื่อ 20 สิงหาคม 2026 หลังเพิ่ม Pharmacy Foundation และ Cashier v1

| เส้นทาง | ผลตรวจ | ข้อสังเกตด้านข้อมูล |
| --- | --- | --- |
| `/medications` | แสดง Access Gate / System Bootstrap ตามสถานะ session | ยังไม่แสดง catalog หรือข้อมูลผู้รับบริการก่อนยืนยัน session |
| `/cashier` | แสดง Access Gate ตามสถานะ session | ยังไม่แสดงข้อมูลผู้รับบริการหรือรายการรับชำระก่อนยืนยัน session |
| `/doctor-console` | แสดง Access Gate ตามสถานะ session | ยังไม่แสดงข้อมูลผู้รับบริการหรือข้อมูลคลินิกก่อนยืนยัน session |

เส้นทาง Medication Catalog ที่ลงทะเบียนในแอปคือ `/medications` ไม่ใช่ `/medication-catalog`.
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
# บันทึกการตรวจรับ: CSV Catalog และ Mobile Navigation

วันที่ตรวจ: 20 สิงหาคม 2026

## Root cause ของ navigation บนมือถือ

`useIsMobile` เคยกำหนดค่าเริ่มต้นเป็น `false` เสมอ และอัปเดตเป็นขนาด viewport จริงภายหลังผ่าน effect เมื่อเกิดการ mount แล้วเท่านั้น ดังนั้น render แรกของ `Sidebar` เลือก desktop branch ซึ่งถูกซ่อนใน mobile breakpoint ทำให้ navigation ไม่อยู่ในสถานะที่เห็นได้ทันที จนเกิด event หรือ re-render ภายหลัง

การแก้ไขอ่านค่า viewport จริงใน state initializer (`matchMedia` ก่อน แล้ว fallback เป็น `innerWidth`) และยังคงรับฟัง `resize` ต่อไป การเปลี่ยนแปลงนี้ไม่แก้ routing, callback ของเมนู, navigation function หรือ desktop layout

## หลักฐานที่ตรวจแล้ว

| รายการ | ผลการตรวจ |
|---|---|
| TypeScript | `pnpm check` ผ่าน |
| Automated suite | Vitest 52 tests ผ่าน รวม CSV parser, CSV import RBAC/error mapping และ mobile initial viewport regression |
| Production build | `pnpm build` ผ่าน |
| Direct entry ของหน้าคลังยาและรายงานบน mobile viewport ขณะไม่ authenticate | แสดง AccessGate ปกติ ไม่มี error render |
| Workspace SYSTEM_ADMIN หลัง authenticate | navigation และ entry point คลังยา/รายงาน/บัญชีบุคลากร render ได้ปกติ โดยไม่พบ PHI |
| Direct entry `/medications` หลัง authenticate | หน้า Catalog โหลดสมบูรณ์ แสดง CTA ดาวน์โหลด template และเลือกไฟล์ CSV ก่อนจุดบันทึกข้อมูล |
| เมนูรายงานสรุปใน workspace | เปลี่ยนไป `/reports` ได้ตามเดิม |
| เมนูคลังยาและราคาใน workspace | เปลี่ยนกลับ `/medications` ได้ตามเดิม |
| เมนูบัญชีบุคลากรใน workspace | เปลี่ยนไป `/staff` ได้ตามเดิม |

การตรวจด้วย browser desktop ยืนยัน direct entry และ navigation contract เท่านั้น ส่วน regression ที่ครอบคลุม initial viewport อยู่ใน Vitest โดยจำลอง viewport mobile ก่อน render เพื่อไม่ให้ต้องอาศัย interaction ภายหลัง

การทดสอบ hard refresh, direct entry และเปลี่ยนหน้าบน mobile workspace ด้วยบัญชีบทบาทจริงควรทำซ้ำโดยผู้ใช้ในอุปกรณ์เป้าหมายหลัง deployment เพื่อยืนยันพฤติกรรมของ Chrome/Android ที่ใช้งานจริง
