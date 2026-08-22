# Release Candidate Evidence — Identity Document P0

**สถานะ:** สร้าง schema PostgreSQL บน Supabase target ที่เจ้าของอนุมัติแล้ว; ยังไม่ commit, push, merge, deploy หรือเชื่อม runtime ของแอปกับฐานข้อมูลใหม่นี้

เอกสารนี้บันทึกหลักฐานของ release candidate ที่แก้ช่องโหว่ P0: ก่อนหน้านี้การสร้าง HN สามารถข้ามเลขเอกสารยืนยันตัวตนได้ ทั้งที่หน้า Front Desk และ API. การแก้ไขนี้บังคับให้ลงทะเบียนใหม่ต้องระบุ **บัตรประชาชนไทย** หรือ **Passport** ตั้งแต่ boundary ของ API และยืนยันซ้ำใน data layer.

| รายการ | ค่า |
| --- | --- |
| Integration branch | `delivery/identity-document-20260822` |
| Base commit | `16270ccc00c3c342654f48ac14b793a36dcc4248` |
| ฐานข้อมูลเป้าหมาย | PostgreSQL / Drizzle |
| Supabase target | project `mor-paul` (`xjwzbwqtdlufflturird`) |
| สถานะฐานข้อมูล | เจ้าของอนุมัติ reset เฉพาะ schema `public`; สร้าง baseline และ identity-document migration สำเร็จ |
| ข้อมูลผู้ป่วยทดสอบ | ไม่ได้สร้าง |

## ขอบเขตของการแก้ไข

การลงทะเบียนใหม่รับ `idDocumentType` แบบจำกัดค่าเป็น `THAI_NATIONAL_ID` หรือ `PASSPORT` และรับ `idDocumentNumber` ที่ไม่ว่างเท่านั้น. Data layer ทำ canonicalization และ validation ซ้ำ: บัตรประชาชนไทยผ่าน checksum เดิม ส่วน Passport ตัดช่องว่างและขีดกลาง แปลงเป็นตัวพิมพ์ใหญ่ ต้องเป็นอักขระ A–Z/0–9 ความยาว 6–20 ตัว และมีตัวเลขอย่างน้อยหนึ่งตัว.

| ชั้นควบคุม | สิ่งที่ปรับ | ผลด้านความปลอดภัย |
| --- | --- | --- |
| Schema | เพิ่มชนิดเอกสารและคอลัมน์ Passport ciphertext, lookup hash และ metadata แบบ nullable | ระเบียนเดิมไม่ถูกบังคับแก้ไขหรือ backfill |
| Data layer | เอกสารใหม่ถูกเข้ารหัสด้วย primitive AES-256-GCM เดิม และสร้าง keyed lookup hash | ไม่บันทึกเลข document แบบ plaintext ในตารางใหม่ |
| Audit | เหตุการณ์การลงทะเบียนเก็บเฉพาะชนิดเอกสาร, สถานะว่าบันทึกแล้ว และแหล่งที่มา | ไม่มีเลขบัตรหรือ Passport ดิบใน metadata |
| API | Zod contract บังคับชนิดเอกสารและเลขที่ trim แล้วไม่ว่าง; คง ASSISTANT-only procedure | ไม่สามารถ bypass UI เพื่อสร้าง HN โดยส่งค่าเอกสารว่าง |
| Front Desk | เพิ่มตัวเลือกบัตรประชาชน/Passport และตรวจค่าก่อนเรียก mutation | ผู้ใช้ไม่เห็นข้อความ “ไม่บังคับ” และไม่เรียก API หากเอกสารว่าง |
| Legacy record | คงเส้นทาง National ID แบบ write-once สำหรับระเบียนเก่าที่ไม่มีชนิดเอกสาร | conditional update ตรวจ affected row ก่อนเขียน audit ป้องกัน audit ที่ไม่สอดคล้องเมื่อเกิด race |

ผลลัพธ์ที่อนุญาตให้แสดงต่อ UI จำกัดเป็นชนิดเอกสารหรือรูปแบบปกปิดเท่านั้น. บัตรประชาชนใช้สองหลักแรกและสามหลักท้าย; Passport ใช้สองหลักแรกและสองหลักท้าย. การแก้ไขนี้ไม่เพิ่ม endpoint ที่อนุญาตให้เปลี่ยนหรือแทนที่เลขเอกสารของระเบียนที่มี identity document แล้ว.

## SQL Migration และผลการใช้จริง

ไฟล์ [`drizzle/manual/20260822_identity_document_p0.unapplied.sql`](../../drizzle/manual/20260822_identity_document_p0.unapplied.sql) เป็น SQL delta เริ่มต้นสำหรับ review เท่านั้น. หลังเจ้าของเลือก reset schema `public` ของ Supabase project เดิม เพื่อแก้ schema drift จึงสร้าง baseline ที่ตรวจทานแล้วเป็น [`drizzle/migrations/0000_stale_boomer.sql`](../../drizzle/migrations/0000_stale_boomer.sql) และ migration identity-document เป็น [`drizzle/migrations/0001_clinic_postgres_baseline_identity_document.sql`](../../drizzle/migrations/0001_clinic_postgres_baseline_identity_document.sql).

> SQL นี้เพิ่ม enum, คอลัมน์ nullable, และ unique index ของ Passport hash เท่านั้น. ไม่มี `DELETE`, `UPDATE`, `INSERT`, `DROP`, backfill หรือคำสั่งบังคับ `NOT NULL` กับระเบียนผู้ป่วยเดิม.

Supabase migration history ที่บันทึกจริงมี `clinic_postgres_baseline` เวอร์ชัน `20260822114258` และ `identity_document_p0` เวอร์ชัน `20260822114318`. การใช้ DDL ดำเนินการหลังคำยืนยัน reset อย่างชัดเจน, ไม่ใช้ `db:push`, ไม่ backfill และไม่สร้างข้อมูลผู้ป่วย.

> Reset นั้นลบทุก object และข้อมูลใน schema `public` เท่านั้นตาม manifest ที่เจ้าของอนุมัติ. ไม่แตะ schema หรือ extension ของ Supabase อื่น เช่น `auth`, `storage`, `vault` และ `extensions`.

## ผลการตรวจสอบภายในเครื่อง

| การตรวจสอบ | คำสั่ง | ผล |
| --- | --- | --- |
| Type contract | `pnpm check` | ผ่าน |
| Regression suite | `pnpm test` | ผ่าน 31 test files / 120 tests |
| Production bundle | `pnpm build` | ผ่าน |
| Diff hygiene | `git diff --check` | ผ่าน |
| SQL scope | ตรวจไฟล์ manual migration | พบเฉพาะ enum, `ALTER TABLE ... ADD COLUMN`, และ unique index |
| Supabase schema metadata | `list_tables` แบบ verbose | สร้าง public schema รวม 25 tables; ตาราง `patients` มีชนิดเอกสารและฟิลด์ Passport ตาม migration |
| Supabase migration history | `list_migrations` | พบ baseline และ identity-document migration ตามลำดับ |
| Supabase security advisor | `get_advisors` | ไม่พบ security lints ณ เวลาตรวจ |

Vitest ที่เพิ่ม/ขยายครอบคลุม schema/API ที่ปฏิเสธเอกสารขาดหายหรือเป็นช่องว่าง, การปฏิเสธบทบาท DOCTOR และ SYSTEM_ADMIN, Passport canonicalization/masking/encryption/hash-only storage, audit ที่ไม่มี plaintext, conditional write ที่แพ้ race และ Front Desk ที่หยุดก่อนเรียก mutation เมื่อเลขเอกสารว่าง.

การ build มีคำเตือนเดิมของ Vite เรื่อง JavaScript bundle ขนาดมากกว่า 500 kB และคำเตือนการตั้งค่า `pnpm` ที่ไม่ถูกอ่านโดยเวอร์ชัน pnpm ที่ใช้; ทั้งสองรายการไม่ทำให้ build ล้มเหลวและไม่ใช่ส่วนหนึ่งของ P0 นี้.

## ไฟล์ที่แก้ไข

| ส่วน | ไฟล์ |
| --- | --- |
| Schema | `drizzle/schema.ts` |
| Migration ที่ใช้บน Supabase | `drizzle/migrations/0000_stale_boomer.sql`, `drizzle/migrations/0001_clinic_postgres_baseline_identity_document.sql` |
| SQL อ้างอิงที่ยังไม่ใช้ | `drizzle/manual/20260822_identity_document_p0.unapplied.sql` |
| Passport helper | `shared/identityDocument.ts` |
| Crypto alias | `server/nationalIdCrypto.ts` |
| Data layer | `server/db.ts` |
| API contract/RBAC | `server/routers/frontDesk.ts` |
| UI | `client/src/pages/FrontDesk.tsx` |
| Regression tests | `server/frontDesk.rbac.test.ts`, `server/nationalId.workflow.db.test.ts`, `client/src/pages/FrontDesk.identityDocument.integration.test.tsx` |

## ข้อจำกัดและการอนุมัติที่ยังต้องมี

release/current `main` ยังถือว่า **ไม่ปลอดภัยสำหรับข้อกำหนดนี้** จนกว่าจะได้รับการ review, commit, merge, deploy และกำหนด runtime ให้เชื่อม PostgreSQL target นี้. การมี branch, schema และผลทดสอบในเครื่องไม่เปลี่ยนพฤติกรรมของระบบที่เผยแพร่อยู่ในขณะนี้.

| รายการค้าง | ผู้อนุมัติ/ผู้ดำเนินการ | เหตุผล |
| --- | --- | --- |
| ตั้งค่า runtime `DATABASE_URL` ให้ชี้ PostgreSQL target อย่างปลอดภัย และยืนยัน schema/runtime version ตรงกัน | Owner/DB operator | environment ปัจจุบันของ managed project ยังเป็น MySQL/MariaDB จึงไม่ควรชี้แอปไปที่ Supabase โดยไม่จัดการ release configuration |
| UAT ลงทะเบียน National ID และ Passport โดยใช้ข้อมูลที่ผู้ใช้บันทึกเอง | Clinic owner / Front Desk | ยืนยัน workflow, Smart Card fallback และข้อความภาษาไทยในสภาพแวดล้อมคลินิก |
| Code review และอนุมัติ commit/push/merge | Owner/reviewer | แยกการอนุมัติ release ออกจากการอนุมัติแผนพัฒนา |
| อนุมัติ deploy | Owner | ป้องกันการเผยแพร่โดยไม่ได้รับอนุญาต |

การแก้ไขนี้เป็น **technical control** สำหรับช่องโหว่ P0 เท่านั้น และไม่ใช่การรับรอง PDPA หรือการรับรองทางกฎหมาย. งาน residual-risk และมาตรการด้าน operations ที่ค้างอยู่ยังต้องดำเนินการแยกจาก release candidate นี้.
