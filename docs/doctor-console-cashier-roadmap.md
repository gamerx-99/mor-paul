# แผนพัฒนา Doctor Console และ Cashier

**โครงการ:** Clinic Mor Phallop HIS  
**สถานะตั้งต้น:** Front Desk มีผู้รับบริการ, visit, triage, queue, local session และ audit event แล้ว โดยไม่มีข้อมูลจำลอง

## หลักตัดสินใจของระยะถัดไป

Doctor Console และ Cashier ต้องพัฒนาเป็นสายงานเดียวกัน ไม่ใช่สองหน้าจอที่แยกจากกันโดยไม่มี contract กลาง การส่งต่อข้อมูลควรเกิดหลังแพทย์ลงนามข้อมูลการตรวจและคำสั่งรักษาเท่านั้น จากนั้นผู้ช่วยจึงเห็นรายการที่อนุญาตให้จ่ายยาและคิดเงินในรูปแบบอ่านอย่างเดียว

> **ลำดับที่ต้องรักษา:** Front Desk/triage → แพทย์ตรวจและลงนาม → จ่ายยา → ออกบิล/รับชำระ → ปิดรายการ

ทุกหน้าจอต้องเริ่มด้วย empty state เมื่อยังไม่มีข้อมูลจริง และห้ามเพิ่มชื่อผู้รับบริการ HN ยา ราคา จำนวนเงิน หรือรายการทดสอบเป็น fixture, mock, seed หรือ hardcode

## ขอบเขตและสิทธิ์

| บทบาท | Doctor Console | Cashier / Dispense | ข้อห้ามสำคัญ |
| --- | --- | --- | --- |
| `DOCTOR` | อ่านข้อมูลผู้รับบริการและ triage, เขียน SOAP, diagnosis, order, ลงนามและทำ addendum | อ่านสถานะการจ่ายยา/การชำระเงินของ encounter ตามจำเป็น | ไม่แก้ไขการรับชำระหรือตัดสต็อกโดยตรง |
| `ASSISTANT` | อ่านเฉพาะข้อมูลที่จำเป็นต่อ workflow แต่ไม่อ่านหรือแก้ SOAP/diagnosis | อ่าน signed order, จ่ายยา, ออก invoice, รับชำระ, พิมพ์เอกสาร | ห้ามแก้ไข signed order, diagnosis หรือราคา master โดยไม่มีสิทธิ์เฉพาะ |
| `SYSTEM_ADMIN` | ไม่มี route หรือ procedure คืน PHI, note, diagnosis, order หรือเอกสารผู้รับบริการ | จัดการ master data ยา/ราคา/บัญชีผู้ใช้ได้โดยไม่มี PHI | ไม่มี patient search, HN, allergy, visit หรือใบเสร็จที่ระบุตัวบุคคล |

การบังคับสิทธิ์ต้องอยู่ใน tRPC procedure และ scoped query ฝั่ง server เสมอ ส่วนการซ่อนปุ่มหรือเมนูบน UI เป็นเพียงการช่วยลดความสับสน ไม่ใช่ security control

## แผนงานตามลำดับการพัฒนา

### ระยะ A — สัญญาการส่งต่อจากคิวสู่ห้องตรวจ

ก่อนสร้างหน้าจอ Doctor Console ให้ขยาย state machine ของ visit และ queue อย่างระมัดระวัง โดยให้แพทย์รับคิวผ่าน transaction ที่ lock รายการ, เปลี่ยนสถานะเป็น `IN_CONSULT`, บันทึกแพทย์ผู้รับผิดชอบ และป้องกันการรับคิวเดียวกันซ้ำจากหลายหน้าจอ เมื่อการตรวจสิ้นสุด แพทย์ต้องลงนาม encounter ก่อนจึงเปลี่ยนไป `DISPENSING`; กรณีไม่มีรายการต้องจ่ายยา ให้ปิด visit ตามเส้นทางที่กำหนดอย่างชัดเจน

| งาน | ผลลัพธ์ที่ต้องได้ | เงื่อนไขความถูกต้อง |
| --- | --- | --- |
| กำหนด transition | ตาราง transition ของ `REGISTERED` ถึง `CLOSED` พร้อม actor ที่ทำได้ | ไม่มีทางลัดจาก triage ไปชำระเงินโดยไม่มีการลงนามของแพทย์ |
| เพิ่ม optimistic concurrency | version หรือ equivalent guard บน visit/order/invoice ที่แก้ไขได้ | mutation ที่ stale ต้องตอบ conflict แทนเขียนทับข้อมูลใหม่ |
| เพิ่ม idempotency | คีย์สำหรับ sign order, dispense, payment และ stock movement | retry request ต้องไม่เกิดตัดสต็อกหรือรับเงินซ้ำ |
| เพิ่ม audit taxonomy | action และ entity ชัดเจนสำหรับ clinical, dispense และ finance | audit metadata ไม่มี SOAP, diagnosis, ชื่อ หรือ HN |

### ระยะ B — Doctor Console v1: EMR และคำสั่งรักษา

Doctor Console รุ่นแรกควรเน้นการบันทึก encounter ให้ครบและตรวจสอบย้อนกลับได้ โดยใช้ layout จาก UI อ้างอิงเป็นแนวทาง: แถบ context ทางซ้ายสำหรับ patient header, allergy summary และ vital signs ล่าสุด; พื้นที่หลักทางขวาสำหรับ SOAP, diagnosis และ orders. ส่วนอัปโหลดเอกสาร, dictation และ ICD-10 search แบบ external integration ให้เลื่อนไปหลังแกน EMR ปลอดภัยและทดสอบแล้ว

#### โมเดลข้อมูลที่ต้องเพิ่ม

| ตาราง/แนวคิด | ข้อมูลหลัก | กติกา |
| --- | --- | --- |
| `clinicalNotes` | `visitId`, subjective, objective, assessment, plan, `status`, author, signedAt | หนึ่ง draft ต่อ visit; signed note lock การแก้ไข |
| `clinicalNoteAddenda` | noteId, amendment text, author, createdAt | เพิ่มเติมแบบ append-only; ไม่เขียนทับ signed note |
| `visitDiagnoses` | visitId, code, display text, rank, enteredBy | เริ่มด้วยการกรอกข้อมูลจริงโดยแพทย์; ไม่ seed disease catalogue |
| `medications` | code, generic/trade name, form, strength, active | master data เปล่าเริ่มต้นและให้ผู้มีสิทธิ์สร้างจากข้อมูลคลินิกจริง |
| `clinicalOrders` | visitId, status, ordering doctor, signedAt, cancelledAt | สถานะ draft/signed/cancelled; ผู้ช่วยอ่านได้เฉพาะ signed |
| `medicationOrderItems` | orderId, medicationId, dose, frequency, duration, quantity, instructions | snapshot คำสั่งรักษาขณะลงนาม; ห้ามผู้ช่วยแก้ไข |
| `procedureOrderItems` | orderId, procedure/service reference, quantity, instructions | รองรับค่าบริการหรือหัตถการในอนาคตโดยไม่ปะปนกับยา |

#### tRPC และ UI ที่ต้องสร้าง

ให้แยก router เป็น `clinical` หรือ `doctorConsole` เพื่อรักษา router เดิมให้เล็กและอ่านง่าย Procedure สำหรับ `DOCTOR` อย่างน้อยต้องมีการเปิด encounter ที่ assigned/eligible, load context, save draft, sign encounter, add addendum, create/update/cancel draft order และ sign order. Procedure สำหรับ `ASSISTANT` ต้องมีเฉพาะ read model ที่คืน signed order เท่าที่ต้องใช้ในการจ่ายยา และห้ามคืน SOAP/diagnosis โดยปริยาย

Doctor Console ต้องมี loading, error และ empty states ที่ชัดเจน เช่น “ยังไม่มีคิวที่ได้รับมอบหมาย” และต้องไม่แสดง patient header ก่อนเลือก encounter จากข้อมูลจริง การลงนามเป็น critical mutation จึงใช้ confirmation dialog, request ID, idempotency key และ cache invalidation หลังสำเร็จ แทน optimistic update ที่เสี่ยงต่อสถานะทางคลินิก

### ระยะ C — Pharmacy/Cashier foundation: ยา ราคา และสต็อก

Cashier จะปลอดภัยได้ก็ต่อเมื่อ master data และร่องรอยการตัดสต็อกเชื่อถือได้ จึงควรสร้าง foundation ก่อนหน้า UI รับเงิน โดยเริ่มจากผู้ดูแลระบบบันทึกยา ราคา และยอดรับเข้าจริงด้วยตนเอง ไม่ seed catalogue หรือ stock balance

| ตาราง/แนวคิด | หน้าที่ | หลักการป้องกันความผิดพลาด |
| --- | --- | --- |
| `medicationPrices` | เก็บราคาตามช่วงเวลาและสถานะ active | invoice line เก็บ snapshot ราคา ไม่อ่านราคาปัจจุบันย้อนหลัง |
| `inventoryLots` | lot/expiry/received quantity ของจริง | เลือก lot ที่จะจ่ายและตรวจวันหมดอายุ |
| `stockMovements` | RECEIVE, DISPENSE, ADJUST, RETURN, VOID พร้อม quantity และ reference | append-only; ไม่แก้ `remainingQuantity` แบบไร้ร่องรอย |
| `dispensations` | visit, dispensing assistant, status, completedAt | รับได้เฉพาะ signed order; cancel/void ต้องมีเหตุผล |
| `dispensationItems` | order item, lot, quantity dispensed | transaction เดียวกับ stock movement และ inventory validation |

ราคาขายและข้อมูลยาเป็น master data ที่ไม่ใช่ PHI จึงจัดการผ่าน `SYSTEM_ADMIN` ได้ แต่ผู้ช่วยไม่ควรแก้ราคามาตรฐาน ควรเริ่มรุ่นแรกโดยไม่มี discount หรือ manual price override; หากจำเป็นในอนาคต ให้เพิ่มสิทธิ์เฉพาะ, เหตุผลบังคับ และ audit event แยกต่างหาก

### ระยะ D — Cashier v1: ใบแจ้งหนี้ การรับชำระ และเอกสารพิมพ์

หน้า Cashier ต้องแสดง patient header และ signed orders เฉพาะเมื่อผู้ช่วยเปิด encounter ที่เข้าสู่ขั้นจ่ายยาแล้ว รายการยาและคำแนะนำใช้ยาจากแพทย์ต้องเป็น **read-only** ทุกการ dispense ต้องตรวจจำนวนยาใน lot และเขียน `stockMovements` ภายใน transaction เดียวกัน

#### โมเดลข้อมูลการเงิน

| ตาราง/แนวคิด | ข้อมูลหลัก | กติกา |
| --- | --- | --- |
| `invoices` | visitId, invoice number, status, total, issuedBy, paidAt | หนึ่ง invoice ที่ active ต่อ visit; void ไม่ลบทิ้ง |
| `invoiceLines` | invoiceId, source type/id, description snapshot, quantity, unit price, line total | เก็บ snapshot เพื่อให้ใบเสร็จไม่เปลี่ยนเมื่อ master price เปลี่ยน |
| `payments` | invoiceId, method, amount, received amount, reference, receivedBy | ใช้ idempotency key; ห้าม payment ซ้ำเกินยอด invoice |
| `invoiceVoids` | invoice/payment reference, reason, actor, approvedAt | ใช้ reversal record; ไม่แก้ตัวเลข payment เดิม |

Cashier v1 ควรเริ่มด้วยวิธีชำระเงินที่บันทึกได้ในระบบ เช่น เงินสดและช่องอ้างอิงการชำระภายนอก โดยยังไม่ผูกผู้ให้บริการ QR หรือ payment gateway ใด ๆ การสร้าง QR, webhook และ reconciliation จะเป็นงานแยกที่ต้องออกแบบ secret, callback verification และ failure/retry policy ก่อนเปิดใช้จริง

หลังชำระสำเร็จ จึงเปิดปุ่มพิมพ์ใบเสร็จและฉลากยา UI ใช้ print CSS ใน route ที่ต้องรับสิทธิ์และมีข้อมูลจาก invoice จริง ไม่สร้าง PDF/ใบเสร็จจากข้อมูลที่ฝังใน client และต้องไม่มี route พิมพ์ที่ `SYSTEM_ADMIN` เรียกผ่าน HN หรือ invoice ID ได้

## การทดสอบและเกณฑ์พร้อมใช้งาน

| ระดับทดสอบ | กรณีที่ต้องผ่านก่อนเปิดแต่ละระยะ |
| --- | --- |
| Schema/migration | migration เพิ่มเฉพาะตาราง/index ใหม่, review SQL ก่อน apply และไม่มี seed record |
| Unit / Vitest | ปฏิเสธ ASSISTANT เมื่อเรียก SOAP/diagnosis, ปฏิเสธ SYSTEM_ADMIN ทุก PHI route, ปฏิเสธ DOCTOR เมื่อแก้ payment/stock, validate state transitions |
| Transaction | sign order ซ้ำไม่สร้าง order ซ้ำ, dispense ซ้ำไม่ตัด stock ซ้ำ, payment retry ไม่สร้าง receipt ซ้ำ, stock ไม่ติดลบ |
| UI | empty/loading/error state, route guard, field validation, confirmation ของ sign/dispense/payment และ responsive touch target สำหรับผู้ช่วย |
| Audit | ทุก mutation สำคัญมี action, actor, entity, outcome, requestId และเวลา โดย metadata ไม่มี clinical content หรือ identifier |
| User acceptance | ผู้ใช้ทดสอบด้วยผู้รับบริการ ยา และยอดเงินจริงของตนเองในสภาพแวดล้อมที่ควบคุมได้; ไม่สร้างข้อมูลทดสอบแทน |

## ลำดับการส่งมอบที่แนะนำ

| Milestone | ส่งมอบ | กำหนดออกนอกขอบเขตชั่วคราว |
| --- | --- | --- |
| 1. Clinical contract | state transition, clinical note draft/sign, diagnosis, signed order, RBAC/audit tests | file upload, dictation, drug catalogue import |
| 2. Doctor Console v1 | หน้าห้องตรวจ desktop/tablet, patient context, SOAP, diagnosis, orders, sign flow | history timeline เต็มรูปแบบ, external ICD search |
| 3. Pharmacy foundation | medication master, price snapshot, lots, stock movement, dispense workflow | auto reorder, supplier purchasing, barcode integration |
| 4. Cashier v1 | invoice, payment, receipt/label print, close visit | QR gateway/webhook, discount workflow, accounting export |
| 5. Hardening | negative RBAC suite, idempotency/concurrency coverage, audit review และ UAT | AI recommendation, social appointment ingestion, external payment automation |

## ประเด็นที่ต้องยืนยันก่อนเริ่ม implementation

ก่อนสร้าง milestone 1 ควรยืนยันรูปแบบเลข invoice/receipt ที่ต้องการ, ขอบเขตชนิดยาและหัตถการที่จะบันทึก, วิธีรับสินค้าเข้าคลังจริง, วิธีการยกเลิก/คืนยา และนโยบายส่วนลด การตัดสินใจเหล่านี้กำหนด schema ที่ถอยหลังแก้ยากและต้องจบก่อน migration ของ Cashier

สำหรับเอกสารผู้รับบริการ, การถ่ายภาพผ่านกล้อง, การแนบผลแล็บ, QR payment, หรือการค้นหา ICD-10 จากบริการภายนอก ให้แยกเป็น phase ต่อเนื่องหลัง milestone 4 เพราะต้องใช้ private storage หรือ integration security เพิ่ม ไม่ควรทำให้ MVP ของ EMR และ billing ซับซ้อนเกินจำเป็น
