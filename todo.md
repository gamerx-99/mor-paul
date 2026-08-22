# รายการดำเนินงาน Clinic HIS

- [x] ยืนยันสแตกขั้นต่ำ: React + Node/Express API + managed MySQL-compatible database โดยตัด Firebase, Cloud Run และบริการแยกส่วนออกจาก MVP
- [x] ออกแบบ username/password authentication: scrypt password hash, secure session cookie, session revocation และบัญชีเริ่มต้นที่มี setup key
- [x] เตรียม full-stack capability และ database environment สำหรับพัฒนา โดยยังไม่เชื่อมข้อมูลผู้ป่วยจริง
- [x] ลบข้อมูลสังเคราะห์และข้อความตัวอย่างของคิว ผู้ป่วย เวชระเบียน ยา การเงิน และสถิติออกจากหน้าจอ
- [x] แทนที่ workbench ด้วย empty states และปุ่มเริ่มงานที่ไม่สร้างข้อมูลโดยอัตโนมัติ
- [x] ยืนยันว่าไม่มี seed script, fixture หรือ mock record ถูกนำไปใช้กับฐานข้อมูลทดสอบของผู้ใช้
- [x] เปรียบเทียบ Firebase + Cloud Functions, Supabase และ full-stack managed backend ตามเกณฑ์ PHI, RBAC, audit, การดูแล และต้นทุนเริ่มต้น
- [x] เลือก production stack และบันทึกเหตุผลกับ trade-off ใน ADR
- [x] กำหนด environment separation, secret handling และ credential ownership ก่อนเชื่อมระบบจริง
- [x] สร้าง Firebase project หรือ platform ที่เลือก และเปิดใช้ authentication provider ที่อนุมัติ — **ยกเลิก** ตามข้อกำหนดสแตกขั้นต่ำและ local username/password
- [x] สร้าง UI/Procedure สำหรับผู้ดูแลในการเพิ่ม ปิดใช้ และกำหนดบทบาทบัญชีบุคลากร โดยบังคับสิทธิ์จาก server และทดสอบ negative access ทั้งสามบทบาท
- [x] เชื่อม queue UI กับข้อมูลว่างจาก backend ก่อน แล้วจึงรับเฉพาะรายการที่ผู้ใช้บันทึกเองผ่าน workflow ที่อนุมัติ
- [x] กำหนด contract สถานะ visit, triage และคิว โดยยึด role matrix ที่ห้าม System Admin เข้าถึง PHI
- [x] สร้าง schema และ tRPC procedure สำหรับลงทะเบียนผู้รับบริการ, visit และ triage โดยไม่มี default record หรือ seed data
- [x] สร้างหน้าจอ Front Desk ที่ให้ผู้ใช้บันทึกและค้นหารายการของตนเอง พร้อม empty, loading และ error state
- [x] ตรวจ RBAC ฝั่ง server สำหรับการลงทะเบียนและการดูคิว โดยทดสอบสิทธิ์ที่ปฏิเสธสำหรับบทบาทไม่เกี่ยวข้อง
- [x] สร้าง workflow EMR, คำสั่งยา, คลังยา และการเงินบน privileged backend ที่มี idempotency และ audit
- [x] พัฒนา Doctor Console v1 สำหรับรับคิว บันทึก SOAP วินิจฉัย และลงนามปิดการตรวจ โดยจำกัดการเขียนข้อมูลคลินิกให้แพทย์
- [x] พัฒนา Pharmacy Foundation และ Cashier v1 สำหรับคำสั่งยา การจ่ายยา สต็อก ใบแจ้งหนี้ และการรับชำระแบบ transaction โดยไม่ seed ยาหรือราคา
- [ ] ตั้งค่า private document storage, file validation, backup, monitoring และ incident runbook
- [ ] ทำ security test, UAT และทดสอบ recovery ก่อน pilot
- [x] ตรวจโครงสร้างและความเข้ากันได้ของ UI ที่อัปโหลดกับ Front Desk, Queue, RBAC และข้อมูลจริงของ Clinic HIS
- [x] จัดทำ roadmap Doctor Console สำหรับ EMR, diagnosis, orders และการส่งต่อไปจ่ายยา โดยกำหนด schema, RBAC และ audit trail
- [x] จัดทำ roadmap Cashier สำหรับ prescription read-only, dispense, stock, invoice, payment และเอกสารพิมพ์ โดยไม่ใช้ข้อมูลสาธิต
- [x] เพิ่ม UI สำหรับตั้งราคา active และรับ inventory lot เข้าสต็อกด้วยข้อมูลจริง เพื่อให้ workflow จ่ายยาไม่ต้องพึ่ง SQL หรือ seed
- [x] เพิ่ม automated tests สำหรับ success path, idempotency และข้อผิดพลาดของ dispense และ payment ก่อน checkpoint Cashier
- [x] เพิ่มฟอร์มรับ inventory lot ใน Medication Catalog และเชื่อมกับ procedure รับสต็อกจริง พร้อม loading/error/success states
- [x] เพิ่ม Vitest สำหรับ payment procedure ให้ครอบคลุม success path, idempotent replay และ error mapping โดยไม่แตะฐานข้อมูลจริง
- [x] เพิ่ม workflow เปลี่ยนรหัสผ่านบุคลากร พร้อมตรวจรหัสผ่านเดิม, hash ใหม่, audit trail และเพิกถอน session อื่นอย่างปลอดภัย
- [x] เพิ่ม session-expiry UX ที่ล้าง client cache ของ PHI แจ้งผู้ใช้เป็นภาษาไทย และกลับหน้า sign-in โดยไม่เกิด loop
- [x] เพิ่ม server-side login rate limiting ที่ไม่เปิดเผยการมีอยู่ของบัญชีและไม่พึ่งบริการภายนอก
- [x] ตรวจ audit coverage ของ mutation ทุกโมดูล และเพิ่ม RBAC/error-mapping tests สำหรับ hardening
- [x] เพิ่มการนำผู้ใช้กลับ AccessGate อัตโนมัติเมื่อ session หมดอายุ และทดสอบว่าไม่เกิด redirect loop บน protected route
- [x] เพิ่ม Vitest สำหรับ auth.changePassword กรณี unauthenticated และสรุป coverage ของ hardening ให้ครบ RBAC/error mapping
- [x] เพิ่มการทดสอบ session-expiry redirect บน protected route เพื่อยืนยันว่าแสดง AccessGate อัตโนมัติและไม่เกิด redirect loop
- [x] บันทึกผล audit coverage review ของ mutation ทุกโมดูล พร้อมรายการ RBAC/error mapping coverage ที่ตรวจสอบได้
- [x] เพิ่ม UI integration test ที่ render SessionExpiryBoundary จาก protected route แล้วตรวจการแสดง AccessGate หลัง session-expiry
- [x] เพิ่ม UI integration test สำหรับ repeated session-expiry และ re-authentication เพื่อยืนยันว่าไม่เกิด redirect loop และกลับ workspace ได้
- [x] จัดทำ environment/credential ownership, backup/recovery และ incident runbook พร้อมกำหนดให้การรับไฟล์ PHI ปิดใช้งานโดยปริยายในรุ่นปัจจุบัน
- [ ] ออกแบบและ implement private document storage พร้อม server-side authorization และ file validation หลังมี workflow เอกสารที่อนุมัติ
- [ ] ตั้งค่า monitoring/backup automation ที่ใช้งานจริง หรือยืนยันเป็น manual control อย่างเป็นทางการพร้อมหลักฐานการทดสอบ recovery
- [x] เพิ่ม server-side aggregate report queries แบบกำหนดช่วงวัน โดยไม่คืน PHI หรือข้อมูลระดับผู้รับบริการ
- [x] เพิ่ม tRPC Reports v1 ที่บังคับ role matrix แยก ASSISTANT, DOCTOR และ SYSTEM_ADMIN พร้อม negative RBAC tests
- [x] เพิ่มหน้า Reports พร้อม loading/empty/error/access states, navigation ตาม role และ CSV export จากข้อมูลที่ผ่าน authorization แล้ว
- [x] ตรวจ privacy ของ report payload/CSV, ทดสอบ TypeScript/Vitest/build และยืนยันด้วยหน้าจอโดยไม่สร้างข้อมูลจำลอง
- [x] เชื่อม Clinical Transit Board หน้าแรกกับข้อมูลคิวจริงตามสิทธิ์ โดยรักษา zero-PHI สำหรับ SYSTEM_ADMIN
- [x] เพิ่ม operational status, loading, empty, error และ action entry points ใน Transit Board โดยไม่สร้างข้อมูลจำลอง
- [x] เพิ่มการทดสอบ role/contract ของ home dashboard และตรวจ TypeScript, Vitest, production build กับหน้าจอจริง
- [x] แก้ logout unit test ให้ mock persistence และไม่หมดเวลาจากการเรียกฐานข้อมูลจริงระหว่าง suite
- [x] เพิ่ม UI/integration test สำหรับ Home dashboard ที่ยืนยันว่า SYSTEM_ADMIN เห็น zero-PHI overview และไม่ trigger frontDesk.listQueue
- [x] เพิ่ม UI/integration test สำหรับ ASSISTANT/DOCTOR บน Home dashboard ให้ครอบคลุม loading, empty, error และ action state ของ Clinical Transit Board
- [ ] เก็บหลักฐานหน้าจอ authenticated Home dashboard ของทั้ง clinical role และ SYSTEM_ADMIN หลังเชื่อมข้อมูลจริง โดยไม่ใช้ข้อมูลจำลอง
- [x] เพิ่ม UI/integration test ของ Home dashboard สำหรับ DOCTOR ที่กดเรียกคิวถัดไปแล้วตรวจ pending/success หรือ error state
- [x] เพิ่ม UI/integration test ของ Home dashboard สำหรับ ASSISTANT/DOCTOR ที่ยืนยัน action entry points ทำงานตาม role ไม่ใช่เพียง render ปุ่ม
- [x] สร้างบัญชีทดสอบจริงสำหรับ SYSTEM_ADMIN, DOCTOR และ ASSISTANT โดยไม่สร้างผู้ป่วย ยา หรือธุรกรรมจำลอง
- [x] ส่งมอบข้อมูลเข้าสู่ระบบทดสอบแก่ผู้ใช้ผ่านข้อความที่ชัดเจนและแนะนำให้เปลี่ยนรหัสผ่านหลังทดสอบ
- [ ] ตรวจ Clinical Transit Board แบบ authenticated ตามบทบาทจากบัญชีทดสอบจริง และเก็บหลักฐาน zero-PHI/clinical view
- [x] รีเซ็ตรหัสผ่านบัญชีทดสอบ DOCTOR และตรวจ login จริงก่อนส่งมอบข้อมูลรับรองแก่ผู้ใช้
- [ ] รีเซ็ตรหัสผ่านบัญชีทดสอบ ASSISTANT และตรวจ login จริงก่อนส่งมอบข้อมูลรับรองแก่ผู้ใช้
- [x] แก้ Reports v1 daily revenue aggregate query ให้ทำงานกับ MySQL/TiDB และไม่แสดง SQL หรือ parameter ภายในแก่ผู้ใช้
- [x] เพิ่มข้อความอธิบายเกณฑ์รหัสผ่านและ password-strength indicator ในฟอร์มสร้างบัญชีบุคลากร
- [x] เพิ่มการทดสอบรายงาน empty-state/error mapping และ password-strength UI ก่อนส่งคืนให้ทดสอบ SYSTEM_ADMIN ซ้ำ
- [ ] ทดสอบ Reports หน้า SYSTEM_ADMIN บน environment จริงหลังแก้ daily revenue query และบันทึกหลักฐานว่าแสดง empty/data state ได้โดยไม่เผย SQL/params ภายใน
- [x] เพิ่ม UI integration test สำหรับ Reports page empty state เพื่อยืนยันข้อความว่างปลอดภัยและไม่เผย SQL/internal parameters
- [x] เพิ่ม UI integration test ที่ยืนยัน helper text และ password-strength indicator เปลี่ยนตาม input จริงและสอดคล้องกับ password policy ของ server
- [x] จัดทำ Project Status Report ภาษาไทยแบบ Markdown ที่สรุป architecture, UI/UX, security, RBAC, งานที่เสร็จ งานคงค้าง และกฎบังคับของ Clinic HIS
- [x] เพิ่ม CSV import สำหรับคลังยาและราคาที่ parse/validate/preview ก่อน commit โดยไม่สร้างข้อมูลจำลอง
- [x] เพิ่ม server-side atomic bulk import สำหรับ medication catalog และ active price พร้อม RBAC, audit trail และ error mapping
- [x] เพิ่ม template CSV, ข้อความอธิบายคอลัมน์ และ test กรณี valid/invalid/duplicate import โดยไม่รับข้อมูลผู้ป่วย
- [x] ตรวจ root cause ของ Mobile Bottom Navigation initial display เฉพาะ CSS/state/conditional rendering/stacking/animation/breakpoint โดยไม่แก้ routing, navigation logic หรือ function ของปุ่ม
- [x] แก้ initial visual state ของ Mobile Bottom Navigation ให้แสดงทันทีหลัง hard refresh/direct entry โดยไม่กระทบ desktop layout
- [x] เพิ่ม regression tests ระดับ DashboardLayout และตรวจ direct entry/route change/ทุกปุ่ม navigation ที่ SYSTEM_ADMIN ใช้งานได้หลังแก้ visual state
- [ ] ทำ UAT hard refresh และ mobile viewport บนอุปกรณ์จริงของ DOCTOR และ ASSISTANT เพื่อยืนยัน navigation ของแต่ละบทบาท
- [x] ออกแบบ schema และ domain contract สำหรับรายการค่าบริการที่แยกจากยา โดยรองรับชื่อบริการ จำนวน หน่วย ราคาต่อหน่วย และรายละเอียดบนใบเรียกเก็บ
- [x] เพิ่ม workflow ให้ ASSISTANT บันทึกค่าบริการของ visit ที่แพทย์ลงนามแล้ว พร้อม RBAC และ audit trail
- [x] ตรวจรับ invoice ให้รวมค่ายาและค่าบริการเป็น line item คนละประเภท พร้อมยอดรวมที่ตรวจสอบได้และไม่แสดง PHI ต่อ SYSTEM_ADMIN
- [x] ตรวจรับเงื่อนไขที่ encounter ต้องได้รับการออกบิลและชำระครบก่อนจึงปิดงานได้ แม้ไม่มีรายการยา
- [x] ตรวจรับ Cashier UI ที่เพิ่มค่าบริการก่อนออกบิล และแสดงสถานะขั้นตอนปิดงานอย่างชัดเจน
- [x] เพิ่ม Vitest ครอบคลุม RBAC, invoice service lines, no-medication billing และการปฏิเสธปิดงานก่อนรับชำระ
- [x] เพิ่ม test workflow ระดับ server: encounter ไม่มีรายการยา → ออกใบเรียกเก็บ → ยังไม่ CLOSED → รับชำระสำเร็จ → CLOSED
- [x] เพิ่ม UI integration test สำหรับ Cashier ที่ครอบคลุมค่าบริการ ออกบิล รับชำระ และข้อความสถานะปิดงาน
- [x] กำหนด data model ของเลขบัตรประชาชนแบบ write-once โดยเก็บเฉพาะค่าที่จำเป็น, ตรวจรูปแบบ, ปกปิดค่าที่ส่งกลับ และหลีกเลี่ยงการแสดงเลขเต็ม
- [x] เพิ่ม schema migration และ server-side validation สำหรับเลขบัตรประชาชน พร้อม unique constraint และ audit event โดยไม่เปิดสิทธิ์ให้ SYSTEM_ADMIN อ่าน PHI
- [x] เพิ่ม workflow Front Desk ให้ ASSISTANT บันทึกเลขบัตรประชาชนด้วยการกรอกเอง และห้ามเปลี่ยนค่าเมื่อมีข้อมูลแล้ว
- [x] ออกแบบ Smart Card integration boundary สำหรับ local reader bridge ที่ไม่ฝัง driver หรือข้อมูลบัตรในเว็บแอป และรองรับการกรอกเองเมื่อไม่มีอุปกรณ์
- [x] เพิ่ม UI ที่แสดงสถานะเลขบัตรแบบ masked, อธิบายข้อจำกัด write-once และไม่แสดงค่าที่อ่านจาก Smart Card โดยไม่จำเป็น
- [x] ใช้มาตรฐาน mask เลขบัตรประชาชน 2 หลักแรกและ 3 หลักท้าย (`12••••••••345`) ในทุก UI และ API response ที่อนุญาตให้แสดงค่า
- [x] เพิ่ม Vitest ครอบคลุม checksum/validation, write-once enforcement, RBAC, masking และ audit trail ของเลขบัตรประชาชน
- [x] สร้างชุด Shared Project Context ใน docs/project-context จากสถานะจริงของโครงการ เพื่อให้แชทใหม่เริ่มงานต่อได้โดยไม่ต้องอ่านบทสนทนาเดิมทั้งหมด
- [x] ตรวจสอบความปลอดภัยของ repository ทำความสะอาดเฉพาะไฟล์ที่ไม่ควร commit และ commit/push โครงการ Clinic HIS ไปยัง remote GitHub เดิม
- [x] จัดทำ Dependency Security Audit แบบ read-only จาก pnpm audit, package manifest และ lockfile โดยวิเคราะห์ผลกระทบจริงและทางเลือก remediation โดยไม่แก้ dependency
- [x] ย้าย runtime ไปที่ Windows localhost (`D:\mor-paul`) ด้วย `pnpm dev:windows`; ยืนยัน HTTP local, `pnpm check`, Vitest 76 tests และ production build สำเร็จ โดยไม่แก้ฟีเจอร์หรือข้อมูลผู้ป่วย

## จากเอกสาร Master Blueprint (นำเข้า 2026-08-20) — เฉพาะรายการที่ยังไม่ครอบคลุมในสแตกปัจจุบัน

- [x] ~~เพิ่มการบันทึกสัญญาณชีพ~~ — ตรวจโค้ดจริงแล้วพบว่ามีอยู่แล้วครบ (ความดัน ชีพจร อุณหภูมิ SpO₂ น้ำหนัก ส่วนสูง) ใน `server/routers/frontDesk.ts` (`recordTriage`) และหน้าจอ Triage ที่ `client/src/pages/QueueBoard.tsx` พร้อม RBAC และ audit trail — รายการเดิมเข้าใจผิด แก้ไขแล้ว
- [x] เพิ่มป้ายเตือนแพ้ยาสีแดงเด่นชัด (`#EF4444`) — ฟิลด์ `allergySummary` มีอยู่แล้วที่ Front Desk ตอนลงทะเบียน แต่ไม่เคยถูกส่งมาที่หน้า Triage/Queue เลย และที่ Doctor Console ใช้สีส้มอ่อนแทนสีแดงที่ประกาศไว้เป็น design token; แก้แล้ว: เพิ่ม `allergySummary` ใน select ของ `listQueueByDate` (`server/db.ts`), เพิ่มป้ายแดงเด่นชัดทั้งในรายการคิวและหน้ารายละเอียดที่ `QueueBoard.tsx`, และปรับกล่องแพ้ยาใน `DoctorConsole.tsx` ให้ใช้สีแดง `#EF4444` เมื่อมีข้อมูล — ทดสอบผ่าน TypeCheck, Vitest 79 tests และ Vite build สำเร็จ
- [x] เพิ่มการค้นหารหัสโรค ICD-10 ในหน้าบันทึก diagnosis ของ Doctor Console
- [x] เพิ่มชุดคำสั่งยา/หัตถการด่วน (Pre-sets) ที่แพทย์กำหนดเองได้ เพื่อลดเวลาสั่งยาซ้ำสำหรับเคสที่พบบ่อย — เพิ่มตาราง `clinicalPresets` ใน schema, tRPC router `listPresets`, `createPreset`, `deletePreset` ใน `server/routers/doctorConsole.ts` พร้อม RBAC, และเพิ่ม UI toolbar พร้อมปุ่มลัด ⚡ นำเข้าคำสั่งด่วนและปุ่มบันทึก Pre-set ใน Doctor Console
- [x] ออกแบบและพัฒนาการพิมพ์ฉลากยาบนกระดาษสติกเกอร์ไดคัท A4 ที่เชื่อมกับข้อมูล dispensation จริง — สร้าง `client/src/components/documents/MedicationLabelPrint.tsx` รองรับเลย์เอาต์สติกเกอร์ A4 (ตาราง 2×4) และฉลากเดี่ยว พร้อมชื่อยา ขนาดยา วิธีใช้ คำเตือน HN และวันที่ เชื่อมต่อปุ่มพิมพ์ใน Cashier และ Doctor Console
- [x] ออกแบบและพัฒนาแบบฟอร์มพิมพ์ใบเสร็จรับเงิน/ใบสรุปรายการยาบนกระดาษ A5 จากข้อมูล invoice จริง — สร้าง `client/src/components/documents/InvoiceReceiptPrint.tsx` และ `shared/bahtText.ts` แปลงยอดเงินเป็นภาษาไทยตัวอักษร พร้อมตารางแจกแจงค่ายา/ค่าบริการ ข้อมูลคลินิก และช่องลงนาม เชื่อมต่อปุ่มพิมพ์ใบเสร็จ A5 ใน Cashier
- [x] ออกแบบและพัฒนาแบบฟอร์มพิมพ์ใบรับรองแพทย์และใบส่งตัวบนกระดาษ A4 จากข้อมูล EMR ที่แพทย์ลงนามแล้ว — สร้าง `client/src/components/documents/MedicalCertificatePrint.tsx` รองรับ 2 แท็บ (ใบรับรองแพทย์ตามมาตรฐานแพทยสภา และใบส่งตัวผู้ป่วย) ดึงข้อมูลสัญญาณชีพ การวินิจฉัย ยาที่ได้รับ พร้อมช่องปรับแต่งวันลาพักรักษาตัวและความเห็นแพทย์ เชื่อมต่อปุ่มพิมพ์ใน Doctor Console
- [x] ประเมินและพัฒนาระบบ QR PromptPay เป็นช่องทางชำระเงินเพิ่มเติมจากเงินสดใน Cashier workflow — พัฒนาโมดูลสร้าง EMVCo payload (`shared/promptpay.ts`), QR matrix generator แบบออฟไลน์ (`shared/qrcode.ts`), คอมโพเนนต์แสดงผล QR (`client/src/components/PromptPayQr.tsx`), รองรับการระบุยอดและเลขอ้างอิงสลิปใน Cashier และใบเสร็จรับเงิน A5
- [x] เพิ่มหน้าจอ Audit Log สำหรับ SYSTEM_ADMIN ที่แสดงเฉพาะ metadata การเข้าใช้งาน/การแก้ไข โดยไม่เปิดเผย PHI ตามหลัก Zero Patient Data Access
- [ ] ออกแบบ workflow ถ่ายภาพเอกสารยินยอม (Consent Form) ผ่านแท็บเล็ตด้วย HTML5 Camera API ที่ส่งเข้า private document storage ทันทีโดยไม่บันทึกลง Camera Roll ของอุปกรณ์ (ต่อยอดจากงาน private document storage ที่ยังค้างอยู่)

## จากการวิเคราะห์ตารางฟังก์ชัน P0–P3 เทียบกับโค้ดจริง (นำเข้า 2026-08-20) — ดูรายละเอียดที่ docs/feature-gap-and-roadmap-th.md

### เฟส A — ปิดช่องว่างความปลอดภัย/ตรวจสอบย้อนหลัง
- [x] เพิ่ม privacy notice / consent checkbox ตอนลงทะเบียนผู้รับบริการที่ Front Desk
- [x] เพิ่มการแจ้งเตือนกรณีข้อมูลผู้ป่วยอาจซ้ำ (ชื่อ+วันเกิดตรงกับที่มีอยู่) ก่อนสร้าง HN ใหม่
- [x] เพิ่มหน้าประวัติการรับบริการแบบสรุปของผู้ป่วยรายคน (Doctor Console ปัจจุบันเห็นเฉพาะ encounter ที่กำลังตรวจ)
- [x] เพิ่ม audit event เมื่อมีการ export รายงาน CSV จาก Reports

### เฟส B — งานหน้าร้าน/การเงินให้สมบูรณ์ขึ้น
- [x] ออกแบบและเพิ่มฟีเจอร์ส่วนลดบนใบแจ้งหนี้ พร้อมระบุเหตุผลและผู้อนุมัติ พร้อม audit trail — เพิ่มฟิลด์ `subtotalSatang`, `discountSatang`, `discountReason`, `discountApprovedBy` ในตาราง `invoices`, ฟอร์มกรอกส่วนลดและเหตุผลในหน้า Cashier และบันทึก audit log ทุกครั้ง
- [x] เพิ่มหน้าจอตรวจนับ/ปิดยอดเงินสดประจำวันสำหรับ Cashier — เพิ่มตาราง `dailyCloseouts`, Backend คำนวณยอดเงินสด/พร้อมเพย์/ยอดรวมที่คาดหวัง, หน้าจอเปรียบเทียบยอดนับได้จริง (Cash Drawer Reconciliation) แสดงผลต่างเงินขาด/เกิน และบันทึกประวัติการปิดรอบกะ
- [ ] เพิ่ม template บันทึกการตรวจ (SOAP) ตามประเภทบริการที่พบบ่อย ทำคู่กับชุดคำสั่งยาด่วนที่ backlog ไว้แล้ว
- [x] เพิ่มจุดสั่งซื้อขั้นต่ำ (reorder point) ต่อรายการยา และแจ้งเตือนของใกล้หมดตามจำนวนคงเหลือ — เพิ่มฟิลด์ `minStockThreshold` ในตาราง `medications`, ระบบคำนวณยอดคงเหลือจริงจาก Lot (`onHandQuantity`), ฟิลเตอร์และป้ายเตือนสต็อกต่ำกว่าเกณฑ์ใน `MedicationCatalog.tsx`, และรายงานจำนวนยาต่ำกว่าเกณฑ์ใน Reports
- [x] เพิ่ม Dashboard: ยอดขายแยกตามวิธีชำระเงิน และจำนวน/ยอดใบแจ้งหนี้ที่ยังไม่รับชำระ — เพิ่ม Card แจกแจงยอดชำระตามช่องทาง (เงินสด, PromptPay, บัตร/โอนอื่นๆ), การ์ดติดตามใบแจ้งหนี้ค้างชำระ (จำนวนใบ + ยอดเงิน), ยาต่ำกว่าเกณฑ์ขั้นต่ำ และอัปเดตส่งออกรายงาน CSV ครบถ้วน

### เฟส C — ฟีเจอร์ใหญ่ที่ต้องตัดสินใจเชิงธุรกิจก่อนเริ่ม (ยังไม่เริ่ม รอคุยกับเจ้าของระบบ)
- [ ] ออกแบบระบบนัดหมายล่วงหน้า (ปฏิทินวัน/สัปดาห์, สถานะไม่มาตามนัด) — ต้องออกแบบ schema ใหม่ทั้งหมด
- [ ] ตัดสินใจช่องทางแจ้งเตือน/ติดตามนัด (SMS / LINE OA / โทรตามรายชื่อด้วยมือ) ก่อนเริ่มพัฒนาระบบเตือนนัด เพราะขัดกับกฎ "ใช้เทคโนโลยีน้อยที่สุด" ที่ยึดไว้เดิม

### ส่งมอบเร่งด่วน 5 ชั่วโมง — Identity Document P0
- [x] เพิ่ม schema และ SQL migration PostgreSQL ที่ยังไม่ถูกใช้สำหรับประเภทเอกสาร เลข Passport ที่เข้ารหัส และ unique lookup hash โดยรักษาเลขบัตรประชาชนเป็น write-once/เข้ารหัส/ปกปิดค่าเดิม
- [x] ปรับ API และ data layer ให้ลงทะเบียนต้องระบุ National ID หรือ Passport พร้อม validation, encryption, lookup hash, masking, audit trail และ ASSISTANT-only RBAC
- [x] ปรับ Front Desk ให้เลือกประเภทเอกสารและห้ามสร้าง HN หากยังไม่กรอกเลขเอกสาร โดยไม่สร้างข้อมูลผู้ป่วยทดสอบ
- [x] เพิ่ม regression tests และรัน TypeScript, Vitest, production build, และตรวจ SQL migration แบบ local-only ก่อนส่งมอบ
- [ ] รอ UAT ด้วยข้อมูลที่ผู้ใช้บันทึกเอง, ตั้งค่า runtime ให้เชื่อม PostgreSQL อย่างปลอดภัย, และอนุมัติ commit/push/merge/deploy ของ release candidate
- [x] ตรวจ baseline ของ PostgreSQL/Drizzle migration history และเตรียม migration identity document ให้เข้ากับฐานข้อมูลเป้าหมาย
- [x] ใช้ baseline และ migration identity document ที่อนุมัติกับ Supabase target แล้วตรวจ schema metadata และ regression ที่เกี่ยวข้อง
- [x] บันทึกผล migration โดยไม่เผย DATABASE_URL, secret หรือ PHI และอัปเดตสถานะ release candidate
- [x] จัดทำรายการ schema ที่ reset ของ Supabase project `mor-paul` และ SQL reset ที่ตรวจทานได้ตามตัวเลือก A2
- [x] ได้รับคำยืนยันสุดท้ายจาก owner ก่อนใช้คำสั่ง reset schema แบบ destructive บน Supabase project `mor-paul`
- [x] หลัง reset ใช้ Drizzle migration artifacts, ตรวจ metadata schema, และทดสอบ release-candidate contract โดยไม่สร้างข้อมูลผู้ป่วย
- [ ] ตรวจ compatibility ของ runtime/deployment กับ PostgreSQL และระบุ DATABASE_URL target ที่ต้องใช้
- [ ] ตั้งค่า DATABASE_URL ของ Supabase ผ่านช่องทาง secrets ที่ปลอดภัยโดยไม่เผย credential
- [ ] ยืนยัน runtime connection, run health/contract checks ที่ไม่สร้าง PHI, และบันทึกผล configuration
- [ ] แก้ Vercel output directory ให้สอดคล้องกับ Vite build output และยืนยัน preview deployment ก่อน merge main
- [ ] merge release candidate identity document เข้า GitHub main โดยรักษา history และตรวจ revision ที่ deploy
- [ ] ตรวจ production health และ AccessGate โดยไม่สร้างหรือเปิดเผย PHI
- [ ] P0: ยืนยันว่า Vercel runtime ใช้ DATABASE_URL ของ PostgreSQL ผ่าน health/aggregate check ที่ไม่อ่านหรือสร้าง PHI
- [ ] P0: บันทึก deployment revision และผล runtime verification โดยไม่เก็บค่า secret หรือ PHI
- [ ] P0: จัดเตรียมหลักฐาน UAT สำหรับ National ID/Passport และ role-critical workflow เพื่อให้ owner ตัดสิน GO/NO-GO
- [ ] P0: แก้ Vercel routing middleware crash จาก middleware ของ Next/Supabase ที่ตกค้างและไม่เข้ากับ Vite/Express runtime แล้วตรวจ production ใหม่
- [ ] P0: แก้ Vercel serverless API route 404 เพื่อให้ tRPC health check เรียก runtime PostgreSQL ได้โดยไม่แตะ PHI
