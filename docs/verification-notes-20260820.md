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
