# รายงานสถานะโครงการ: คลินิกหมอพัลลภ (Clinic HIS)

> **สถานะเอกสาร:** สรุปจากประวัติการพัฒนาและข้อตกลงที่ยืนยันแล้ว ณ วันที่ 20 สิงหาคม 2026 (GMT+7)  
> **สถานะรุ่นซอฟต์แวร์ล่าสุด:** `d113c0da` — เผยแพร่แล้วผ่านระบบโฮสติ้งของโครงการ

## 🎯 Executive Summary

โครงการ **คลินิกหมอพัลลภ** คือระบบ Hospital Information System (HIS) สำหรับคลินิกขนาดเล็ก ซึ่งออกแบบให้ใช้เทคโนโลยีเท่าที่จำเป็น รองรับปริมาณงานประมาณ 100 เคสต่อเดือน และเน้นการทำงานจริงของ Front Desk, ห้องตรวจ, คลังยา, การเงิน และรายงาน โดยยึดหลักคุ้มครองข้อมูลส่วนบุคคลตามแนวทาง PDPA และหลักการเข้าถึงข้อมูลเท่าที่จำเป็นต่อหน้าที่

ระบบแกนหลักได้รับการพัฒนาแล้วตั้งแต่การยืนยันตัวตน, ทะเบียนผู้รับบริการ, คิวและคัดกรอง, Doctor Console/EMR, คลังยา, Cashier, รายงานสรุป, นำเข้าคลังยาด้วย CSV, ค่าบริการแยกจากค่ายา และการบันทึกเลขบัตรประชาชนแบบ write-once งานที่ยังต้องทำต่อส่วนใหญ่เป็น **UAT กับผู้ใช้จริง/อุปกรณ์จริง** และการตัดสินใจเชิงปฏิบัติการก่อนเปิดใช้จริง ไม่ใช่การสร้างข้อมูลตัวอย่าง

| มิติ | สถานะปัจจุบัน |
|---|---|
| กระบวนการทางคลินิกและการเงินหลัก | พัฒนาแล้ว พร้อม UAT |
| สิทธิ์และขอบเขต PHI | กำหนดและทดสอบแล้ว |
| CSV คลังยา/ราคา | พร้อมใช้งานแบบตรวจสอบก่อนบันทึก |
| ค่าบริการและการปิดงานหลังชำระ | พัฒนาและทดสอบแล้ว |
| เลขบัตรประชาชน/Smart Card | เว็บแอปและจุดเชื่อมต่อพร้อม; รอทดสอบเครื่องอ่านจริง |
| การทดสอบอัตโนมัติ | ผ่าน 68 Vitest tests, TypeScript และ production build ณ checkpoint ล่าสุด |

## ✅ Completed Specifications

### 1. โครงสร้างระบบและเทคโนโลยี (Architecture)

ระบบใช้สถาปัตยกรรม full-stack แบบ lean และ serverless-friendly โดยลดการพึ่งพาบริการภายนอกที่ไม่จำเป็น

| ชั้นระบบ | ข้อกำหนด/เทคโนโลยีที่ตกลงและพัฒนาแล้ว |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4, shadcn/ui, wouter และ framer-motion |
| Backend/API | Express 4, tRPC 11 และ Superjson |
| ฐานข้อมูล | MySQL/TiDB ผ่าน Drizzle ORM และ `mysql2` |
| การยืนยันตัวตน | Local username/password; ไม่ใช้ OAuth/SSO เป็น workflow หลัก |
| การเข้ารหัสรหัสผ่าน | scrypt (`N=2^17`, `r=8`, `p=1`) พร้อม password policy ฝั่ง server |
| Session | Cookie `httpOnly`, token hash SHA-256 ในฐานข้อมูล, อายุ session 8 ชั่วโมง |
| การทดสอบและ build | Vitest, TypeScript check, Vite/esbuild production build, `pnpm` |
| การโฮสต์ | โฮสติ้งในโครงการแบบ autoscale และเผยแพร่ทุกครั้งเมื่อบันทึก checkpoint |

ระบบแยกชั้น domain และข้อมูลให้ชัดเจน โดยมี schema สำหรับผู้ใช้, session, ผู้รับบริการ, visit, triage, queue, clinical note, diagnosis, ยา/ราคา/ล็อตคงคลัง, medication order, dispensation, invoice, payment, service charge และ audit event แล้ว

### 2. โมดูลที่พัฒนาแล้ว (Functional Scope)

| โมดูล | ความสามารถที่เสร็จแล้ว |
|---|---|
| Local Access & Staff | Bootstrap/login ด้วย username/password, จัดการบุคลากร, เปลี่ยนรหัสผ่าน, deactivate account, revocation ของ session และป้องกันการลบ System Admin คนสุดท้าย |
| Front Desk & HN | ค้นหา/ลงทะเบียนผู้รับบริการ, ออก HN, สร้าง visit และเชื่อม workflow คิวโดยไม่ใช้ข้อมูลสาธิต |
| Triage & Queue | คัดกรอง, แสดงคิวจริงตามสิทธิ์, เรียกคิว และ Clinical Transit Board ที่แยกข้อมูลตามบทบาท |
| Doctor Console / EMR | บันทึก SOAP draft, diagnosis, medication order จาก catalog จริง, optimistic revision และลงนามปิดการตรวจ |
| Pharmacy | จัดการ medication catalog, ราคา active, รับล็อตยา, คงคลังแบบ FEFO และจ่ายยาตามคำสั่งแพทย์ที่ลงนามแล้ว |
| Cashier & Billing | เพิ่มค่าบริการแยกจากยา, สร้าง invoice ที่แบ่ง line item เป็นยา/บริการ, รับชำระแบบ idempotent และปิด visit หลังชำระสำเร็จเท่านั้น |
| Reports v1 | สรุปยอด visit, รายได้ และ inventory แบบ aggregate, ควบคุมสิทธิ์ และ export CSV ป้องกัน formula injection |
| CSV คลังยาและราคา | ดาวน์โหลด template, parse/validate/preview ก่อนยืนยัน, ตรวจ duplicate/รูปแบบ, atomic bulk import, RBAC และ audit trail |
| เลขบัตรประชาชน | Validation checksum, encryption at rest, lookup hash ที่ unique, write-once enforcement, audit trail และการส่งกลับแบบ masked-only |
| Smart Card Boundary | มี browser-side Local Smart Card Bridge contract สำหรับเชื่อมเครื่องอ่านในอนาคต โดยไม่ฝัง driver หรือเข้าถึงข้อมูลบัตรเกินความจำเป็นในเว็บแอป |

### 3. Workflow การเงินที่ตกลงและพัฒนาแล้ว

ค่าบริการและค่ายาเป็นข้อมูลคนละประเภทเสมอ ผู้ช่วยสามารถกรอกชื่อบริการ รายละเอียด จำนวน หน่วย และราคาต่อหน่วย เพื่อสร้างรายการค่าบริการก่อนออกใบเรียกเก็บ ระบบรวมรายการยากับค่าบริการใน invoice เดียว แต่เก็บ `line type` แยกกันเพื่อให้ตรวจสอบยอดได้

> **กฎ workflow:** เมื่อแพทย์ลงนาม encounter แล้ว ต้องส่งต่อเข้าสู่ Cashier ทุกครั้ง แม้ไม่มีคำสั่งยา และ visit จะเปลี่ยนเป็น `CLOSED` ได้เฉพาะเมื่อสร้างใบเรียกเก็บและรับชำระสำเร็จครบตามยอดแล้วเท่านั้น

ธุรกรรมสร้าง invoice และรับชำระมีการควบคุม idempotency, validation และ audit trail เพื่อป้องกันการคิดเงินหรือปิดงานซ้ำ

### 4. UI/UX และภาษาการใช้งาน

การออกแบบเป็น **Clinical Transit Board / workbench** ที่เน้นการทำงานจริงของคลินิก ใช้ภาษาไทยเป็นหลัก, background โทน ivory และองค์ประกอบที่อ่านง่าย มี empty/loading/error states และรองรับมือถือ

| Design token | ค่าที่ตกลง |
|---|---|
| Primary — Transit Teal | `#2E7E86` |
| Secondary — Green | `#79A388` |
| Accent | `#BCC996` |
| Background | `#E6ECC8` |
| Danger / Allergy Alert | `#EF4444` |
| Typography | Kanit / Sarabun |

ใช้หลัก Contrast, Alignment, Repetition, Proximity, Hierarchy, White Space, Scale, Balance, Unity และ Consistency เป็นเกณฑ์ออกแบบมาตรฐาน หน้าจอ Mobile Bottom Navigation ได้แก้ initial display state แล้ว โดยไม่เปลี่ยน routing, navigation logic หรือ callback ของปุ่มเดิม และมี regression tests ยืนยันการ render แรกตามบทบาท

### 5. สิทธิ์ผู้ใช้งานและขอบเขตข้อมูล (RBAC)

| บทบาท | สิทธิ์หลัก | ข้อจำกัดสำคัญ |
|---|---|---|
| `SYSTEM_ADMIN` | Platform, staff accounts, medication catalog, รายงานสรุปเชิง aggregate | **ห้ามเข้าถึง PHI**, clinical notes, เลขบัตรเต็ม หรือข้อมูลการรักษารายบุคคล |
| `DOCTOR` | Queue/triage ที่เกี่ยวข้อง, EMR, SOAP, diagnosis, medication order, sign encounter | ไม่จัดการ platform/staff และไม่ทำ Cashier workflow |
| `ASSISTANT` | ลงทะเบียน, HN, triage, queue, คลังยา/dispense, ค่าบริการ, invoice, payment, บันทึกเลขบัตรครั้งแรก | ไม่มีสิทธิ์อ่านหรือแก้ไข EMR/clinical note |

มี tRPC middleware แยก `public`, `protected`, `assistant`, `doctor`, `admin` และ medication catalog read procedures เพื่อให้การควบคุมสิทธิ์อยู่ที่ server เป็นหลัก ไม่พึ่งพาเฉพาะการซ่อนเมนูบนหน้าจอ

### 6. ความปลอดภัย การคุ้มครองข้อมูล และการตรวจสอบย้อนหลัง

ระบบวาง security model และ audit coverage สำหรับ mutation สำคัญแล้ว เช่น การจัดการบัญชี, การลงทะเบียน, triage, clinical note, medication order, dispensation, inventory lot, service charge, invoice, payment และเลขบัตรประชาชน

| หัวข้อ | มาตรการที่พัฒนาแล้ว |
|---|---|
| การลดข้อมูล | Query และ API คืนข้อมูลเท่าที่บทบาทนั้นต้องใช้; System Admin ได้เฉพาะข้อมูล aggregate/zero-PHI |
| รหัสผ่าน | ข้อกำหนดขั้นต่ำ 12 ตัวอักษร, มีพิมพ์ใหญ่, พิมพ์เล็ก, ตัวเลขและอักขระพิเศษ พร้อม strength indicator |
| Session | expiry boundary, session revocation และ login rate limiting |
| ความผิดพลาด | Error mapping ไม่เผย SQL, parameter หรือรายละเอียด infrastructure ต่อผู้ใช้ |
| Export | CSV report ป้องกัน formula injection และไม่ส่งออก PHI เกินสิทธิ์ |
| เลขบัตรประชาชน | เข้ารหัสเมื่อจัดเก็บ, unique lookup hash, write-once, masked-only response และ audit; ไม่คืน ciphertext หรือเลขเต็มใน response ปกติ |
| Masking | แสดงได้เฉพาะ 2 หลักแรกและ 3 หลักท้าย เช่น `12••••••••345` |

## 🚧 Pending Tasks & Next Steps

### 1. UAT ที่ต้องทำกับผู้ใช้และอุปกรณ์จริง

| ลำดับ | งาน | เกณฑ์รับมอบ |
|---|---|---|
| 1 | UAT Mobile สำหรับ DOCTOR และ ASSISTANT | Hard refresh, direct entry, เปลี่ยนหน้าแล้วกลับมา และแตะทุกเมนูที่สิทธิ์อนุญาต โดย Bottom Navigation ต้องแสดงทันที |
| 2 | UAT Cashier workflow | ทดสอบทั้งกรณีมีและไม่มีรายการยา: ลงนาม → เพิ่มค่าบริการ → ออกบิล → รับชำระ → ปิดงาน |
| 3 | UAT เลขบัตรประชาชน | ตรวจเลขผ่าน checksum, ตรวจเลขซ้ำ, ตรวจ write-once, ตรวจว่าหน้าจอ/API แสดงเฉพาะ `12••••••••345` |
| 4 | ทดสอบ Smart Card จริงที่คลินิก | ระบุรุ่นเครื่องอ่านและ OS ของเครื่องหน้าเคาน์เตอร์ แล้วติดตั้ง/ตั้งค่า Local Smart Card Bridge ให้ตรง driver ของอุปกรณ์ |

### 2. งานปฏิบัติการก่อนใช้งานจริง

ยังต้องยืนยันผู้รับผิดชอบและหลักฐานสำหรับการสำรองข้อมูล, recovery test, การจัดการ incident และ monitoring หลังเผยแพร่ การรับ/จัดเก็บเอกสารส่วนบุคคลหรือใบยินยอมยังไม่ได้เปิดใช้ เพราะต้องอนุมัติ workflow, retention, สิทธิ์เข้าถึง และพื้นที่จัดเก็บ private storage ก่อน

### 3. ข้อจำกัด Smart Card ในสถานะปัจจุบัน

เว็บแอปไม่สามารถสื่อสารกับ driver/USB Smart Card reader โดยตรงจาก browser ได้อย่างปลอดภัย จึงเตรียมเพียง integration boundary และ manual entry fallback ไว้ก่อน การเปิดใช้งานจริงต้องทำในเครื่องคลินิกที่มีอุปกรณ์, driver และ Local Smart Card Bridge ที่ตรงกับรุ่นเครื่องอ่านเท่านั้น

## 📜 Core Rules & Constraints

### กฎข้อมูลและความเป็นส่วนตัว

1. **Zero Patient Data Access สำหรับ SYSTEM_ADMIN:** System Admin ห้ามเห็น PHI, clinical record, ข้อมูลผู้ป่วยรายบุคคล หรือเลขบัตรประชาชนเต็มโดยเด็ดขาด
2. **Need-to-know / Data minimization:** ทุก query, API response และหน้าจอต้องส่งและแสดงข้อมูลเท่าที่จำเป็นต่อบทบาทและงานนั้น
3. **ไม่ใช้ mock หรือ seed data:** การทดสอบ UAT ใช้ข้อมูลจริงที่ผู้ใช้กรอกเอง; ห้ามใส่ข้อมูลผู้ป่วย ยา ธุรกรรม หรือรีวิวปลอมในระบบ
4. **Audit ทุก mutation สำคัญ:** การเปลี่ยนข้อมูลทางคลินิก การเงิน คลังยา บัญชี และเลขบัตรต้องทิ้งร่องรอยตรวจสอบย้อนหลัง
5. **เลขบัตรประชาชนเป็น write-once:** บันทึกได้เฉพาะครั้งแรกโดย ASSISTANT ที่ได้รับสิทธิ์; หลังบันทึกแล้วแก้ไขไม่ได้ผ่าน workflow ปกติ และค่าแสดงต้อง mask แบบ 2 หน้า/3 ท้ายเท่านั้น

### กฎ workflow ทางคลินิกและการเงิน

1. แพทย์เท่านั้นที่สร้าง/แก้ไข EMR, SOAP, diagnosis และ medication order
2. ผู้ช่วยเท่านั้นที่ดำเนินงาน Front Desk, triage, dispense, ค่าบริการ, invoice และ payment ตามสิทธิ์
3. encounter ที่แพทย์ลงนามแล้วต้องเข้าสู่ขั้นตอน Cashier ทุกครั้ง แม้ไม่มีการสั่งยา
4. visit ปิดงานได้หลังสร้าง invoice และรับชำระสำเร็จครบเท่านั้น
5. ค่ายาและค่าบริการต้องเก็บเป็นคนละ line type แม้อยู่ใน invoice เดียวกัน

### กฎเทคนิคและ UX

1. ใช้เทคโนโลยีน้อยที่สุด: React/TypeScript/Tailwind + Express/tRPC + MySQL/TiDB/Drizzle; ไม่เพิ่ม Firebase, Google Cloud หรือ cloud service หลายตัวโดยไม่มีเหตุผลที่อนุมัติ
2. ใช้ local username/password เป็นวิธีเข้าใช้หลัก ไม่เปลี่ยนเป็น OAuth/SSO โดยพลการ
3. รักษา Earth Tone / Green Aesthetic ด้วยสี `#2E7E86`, `#79A388`, `#BCC996`, `#E6ECC8` และ danger `#EF4444`
4. UI ต้องเป็น Thai-first, ใช้ Kanit/Sarabun, มีลำดับข้อมูลชัดเจน, whitespace เพียงพอ และรองรับมือถือ
5. เมื่อแก้ Mobile Bottom Navigation ห้ามเปลี่ยน routing, navigation logic หรือ function ของปุ่ม หากไม่มีข้อกำหนดใหม่ที่อนุมัติ
6. การเชื่อม Smart Card ต้องใช้ local bridge ในเครื่องคลินิก; ห้ามฝัง driver, secret หรือเลขบัตรเต็มไว้ใน frontend

## เอกสารประกอบที่มีในโครงการ

| เอกสาร | เนื้อหา |
|---|---|
| `docs/security-model.md` | Role matrix, privacy boundary และ export constraints |
| `docs/audit-coverage-review.md` | ขอบเขต audit ของ mutation แต่ละโมดูล |
| `docs/operations-readiness-runbook.md` | แนวทาง environment, backup/recovery และ incident response |
| `docs/uat-checklist.md` | รายการทดสอบ UAT ที่หลีกเลี่ยงการบันทึก PHI ลงเอกสาร |
| `docs/verification-notes-20260820.md` | หลักฐานการตรวจ mobile navigation และ direct-entry regression |
| `docs/national-id-design.md` | การออกแบบข้อมูลเลขบัตรประชาชนและข้อจำกัดการจัดเก็บ |
| `docs/smart-card-bridge-contract.md` | ข้อกำหนด Local Smart Card Bridge สำหรับติดตั้งกับอุปกรณ์จริงในอนาคต |

---

**ข้อสรุปสำหรับการจัดการโครงการ:** ระบบอยู่ในสถานะพร้อมสำหรับ UAT แบบควบคุมสิทธิ์ในส่วนงานหลักแล้ว ขั้นตอนสำคัญถัดไปคือให้ผู้ใช้แต่ละบทบาททดสอบ workflow จริง, ทดสอบมือถือและ Smart Card กับอุปกรณ์จริง, และยืนยันแนวทาง backup/incident/document storage ก่อนเปิดใช้ในคลินิกอย่างเป็นทางการ
