# Handoff Guide for a New AI Chat

## จุดประสงค์

ชุดเอกสารนี้ช่วยให้แชทใหม่เริ่มงานต่อในโครงการ **คลินิกหมอพัลลภ (Clinic HIS)** ได้โดยไม่ต้องอ่านบทสนทนาเดิมทั้งหมด ให้ยึด source code และเอกสารใน repository เป็นหลัก หากข้อมูลขัดกัน ให้ถือว่า **schema/router/test/current source code** เป็นหลักเหนือสรุปเก่า และแจ้งเจ้าของโครงการเมื่อยังไม่สามารถยืนยันได้

## ลำดับการอ่านที่บังคับ

อ่านไฟล์ต่อไปนี้ก่อนเสนอหรือทำงานทุกครั้ง:

1. `docs/project-context/PROJECT_OVERVIEW.md`
2. `docs/project-context/CURRENT_STATE.md`
3. `docs/project-context/TODO.md`
4. `docs/project-context/SECURITY_PDPA.md`
5. `docs/project-context/AUTH_AND_ROLES.md`

จากนั้นอ่านตามประเภทงาน:

| ประเภทงาน | ไฟล์ที่ต้องอ่านเพิ่ม |
|---|---|
| แก้ UI, route, responsive/mobile | `UI_UX_SPEC.md`, `client/src/App.tsx`, `client/src/components/DashboardLayout.tsx`, `client/src/hooks/useMobile.tsx` |
| แก้ Front Desk/Doctor/Cashier flow | `CLINIC_WORKFLOW.md`, `FEATURE_SCOPE.md`, router/page/test ที่เกี่ยวข้อง |
| แก้ schema/query/transaction | `DATABASE_SPEC.md`, `drizzle/schema.ts`, migration ที่เกี่ยวข้อง, `server/db.ts` |
| แก้ login, role, session | `AUTH_AND_ROLES.md`, `docs/security-model.md`, `server/routers.ts`, `server/localAuth.ts` |
| แก้ PHI, reports, national ID, audit | `SECURITY_PDPA.md`, `docs/security-model.md`, `docs/national-id-design.md`, `docs/audit-coverage-review.md` |
| Smart Card | `CLINIC_WORKFLOW.md`, `docs/smart-card-bridge-contract.md`, `client/src/lib/smartCardBridge.ts` |
| UAT/backup/incident/pilot | `TODO.md`, `KNOWN_ISSUES.md`, `docs/operations-readiness-runbook.md`, `docs/uat-checklist.md` |

## สถานะล่าสุดที่ต้องรู้

- ฟังก์ชันคลินิกหลักพัฒนาแล้วและผ่าน test/build ตามรายงานสถานะล่าสุด; งานที่เหลือส่วนใหญ่เป็น UAT และ operational evidence
- ไม่มีข้อมูลผู้รับบริการ ยา หรือธุรกรรมที่สร้างแบบ seed/mock สำหรับระบบ
- SYSTEM_ADMIN เป็น zero-PHI อย่างเคร่งครัด
- Smart Card มี local bridge boundary และ manual fallback แต่ยังไม่ทดสอบกับ reader จริง
- File/document upload ที่มี PHI ยังปิดใช้งานโดยเจตนา
- Current actions ที่รอเจ้าของโครงการอยู่ใน `TODO.md`; อย่าสร้างฟีเจอร์ใหม่จากข้อสันนิษฐาน

## กฎห้ามละเมิด

1. **ห้าม** ให้ `SYSTEM_ADMIN` เห็น PHI, EMR, diagnosis, encounter medication, full national ID หรือ person-identifying export
2. **ห้าม** seed, mock หรือ hardcode patient, medication, financial transaction หรือ testimonial data
3. **ห้าม** ส่ง full national ID หรือ ciphertext ออก API/UI; ต้อง masked-only และ write-once
4. **ห้าม** ปิด visit โดยข้าม invoice/payment; signed encounter ต้องผ่าน Cashier แม้ไม่มีรายการยา
5. **ห้าม** แก้ route/navigation logic หรือ desktop layout เพื่อแก้ mobile display issue โดยไม่มี requirement ใหม่
6. **ห้าม** เพิ่ม Firebase, Google Apps Script, OAuth/SSO, document upload หรือ cloud service ใหม่โดยไม่มีอนุมัติ
7. **ห้าม** ใส่ PHI/secret ใน log, test fixture, screenshot, docs, chat หรือ audit metadata

## วิธีทำงานเมื่อได้รับ task ใหม่

1. จัดประเภทงานและอ่านเอกสารตามตารางข้างต้น
2. ตรวจ source code และ tests ของ domain ที่ได้รับผลกระทบก่อนสรุป root cause หรือออกแบบ
3. ถ้าเป็น change request ให้เพิ่มรายการ `[ ]` ใน root `todo.md` ก่อนแก้ไขใด ๆ
4. รักษา RBAC, audit, data minimization, transaction และ idempotency ที่มีอยู่
5. หากเปลี่ยน database ให้แก้ schema → generate migration → review SQL → apply migration ด้วย workflow ที่อนุมัติ
6. เพิ่มหรือปรับ Vitest ตาม behaviour ที่เปลี่ยน และรัน `pnpm check`, `pnpm test`, `pnpm build`
7. ทำเครื่องหมาย root `todo.md` เป็น `[x]` เมื่อเสร็จ; อ่าน todo ทั้งไฟล์ก่อน checkpoint
8. บันทึก checkpoint หลังงานเสร็จและแจ้งผลโดยไม่กล่าวเกินหลักฐาน

## จุดที่ต้องถามเจ้าของโครงการก่อนดำเนินการ

| เรื่อง | เหตุผล |
|---|---|
| UAT ด้วยข้อมูลจริง | ต้องมี owner/custodian/incident roles ครบก่อนเริ่ม |
| Smart Card | ต้องทราบรุ่น reader, OS, driver และอุปกรณ์เป้าหมาย |
| File/document workflow | ต้องมี privacy approval และ storage/retention/security design ที่อนุมัติ |
| การเปลี่ยน role/PHI access | เป็น security boundary; ห้ามอนุมานความต้องการ |
| การเพิ่ม integration/cloud service | ขัดกับ minimal-stack constraint หากไม่ได้รับอนุมัติ |

## เอกสารอ้างอิงเดิมที่ยังสำคัญ

- `docs/project-status-report-th.md` — รายงานสถานะภาษาไทยแบบกว้าง
- `docs/ADR-003-minimal-local-auth-stack.md` — สถาปัตยกรรมขั้นต่ำที่ใช้จริง
- `docs/security-model.md` — permission/data-path contract
- `docs/operations-readiness-runbook.md` — go/no-go, backup/recovery, incident
- `docs/uat-checklist.md` — แบบทดสอบ UAT ที่ไม่ใส่ PHI

## สรุปสำหรับเริ่มงานทันที

เริ่มจาก `TODO.md` และอย่าพัฒนาเพิ่มหากงานเป็น **Blocked** หรือจำเป็นต้องมี owner decision ระบบปัจจุบันควรได้รับการดูแลในฐานะผลิตภัณฑ์ที่พร้อม UAT แบบควบคุม ไม่ใช่ระบบที่เปิดใช้กับ PHI ได้โดยไม่มี operational gate

