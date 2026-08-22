# สถานะ Runtime และ Deployment — Release Candidate P0

**สถานะเอกสาร:** ตรวจสอบล่าสุด 22 สิงหาคม 2026 (UTC+7)
**ขอบเขตการตรวจ:** GitHub/Vercel deployment, API health, PostgreSQL readiness และ AccessGate เท่านั้น โดยไม่สร้าง อ่าน แสดง หรือบันทึก PHI

## ผลสรุปทางเทคนิค

Release candidate ด้าน Identity Document ถูก merge เข้า GitHub `main` แล้วผ่าน pull request #9 เป็น merge commit `f58b067`. Vercel production deployment ของ revision นี้และ direct redeploy หลัง owner แก้ environment secret อยู่ในสถานะ **Ready**. การทดสอบใช้ deployment `mor-paul-2143iyc0n-gamerx-99s-projects.vercel.app` ซึ่งเป็น direct redeploy ล่าสุดของ revision เดียวกัน [1] [2]

| รายการตรวจ | วิธีตรวจที่อนุญาต | ผล | ขอบเขตข้อมูล |
|---|---|---|---|
| Vercel production build | ตรวจ deployment status จาก dashboard | Ready | ไม่มี secret/PHI |
| PostgreSQL readiness | `auth.setupStatus` ซึ่งใช้ `count(users)` แบบ aggregate-only | สำเร็จ: `requiresSetup: true`, `setupEnabled: false` | ไม่มี row ผู้ใช้หรือ PHI |
| API liveness | `system.health` ด้วย input ที่ schema อนุญาต | สำเร็จ: `ok: true` | ไม่อ่านฐานข้อมูล |
| AccessGate | เปิด root แบบไม่ล็อกอิน | แสดง System Bootstrap ตาม expected state | ไม่มี PHI |
| Error hygiene | ตรวจ source/test และ deploy safe-error mapping | readiness failure จะคืนข้อความไทยทั่วไป ไม่คืน raw SQL หรือ schema detail | ไม่มี SQL/secret ใน response |

> ผล `requiresSetup: true` ยืนยันว่า aggregate count ของ `public.users` เป็นศูนย์ ขณะที่ `setupEnabled: false` สะท้อนว่า environment `INITIAL_SETUP_KEY` ไม่มีค่าพร้อมใช้ใน deployment นั้น จึงยังไม่ควรสร้างบัญชีผ่านหน้า bootstrap จนกว่า owner จะตั้งค่า secret ผ่าน Vercel UI ด้วยช่องทางปลอดภัย

## เหตุการณ์แก้ไขที่ยืนยันแล้ว

| P0 ที่เคยเป็น blocker | การแก้ไขที่อยู่บน `main` | หลักฐานผล |
|---|---|---|
| Vite output path ไม่ตรง Vercel | ตั้ง `outputDirectory` เป็น `dist` | Preview/production build ผ่าน |
| Next/Supabase middleware ตกค้าง | เอา middleware ที่ไม่เข้ากับ Vite/Express ออก | ไม่พบ `MIDDLEWARE_INVOCATION_FAILED` ใน deployment ล่าสุด |
| tRPC filesystem route เป็น 404 | เพิ่ม Vercel entry สำหรับ `/api/trpc/[...path]` | เรียก `auth.setupStatus` และ `system.health` สำเร็จ |
| ESM/Express dynamic-require crash | ใช้ ESM wrapper กับ CommonJS bundled handler ที่ source-controlled | Function เข้าถึง runtime ได้ |
| `DATABASE_URL` ไม่ถูก inject หรือชี้ target ไม่ตรง | owner แก้ผ่าน Vercel secret UI และ direct redeploy | `count(users)` สำเร็จบน database ที่มี schema target |
| Raw SQL จาก readiness error | catch-and-map เป็นข้อความไทยทั่วไป พร้อม regression test | source/tests และ merge commit `f58b067` [2] |

## ขอบเขตที่ยังไม่ใช่ GO-LIVE

การยืนยันครั้งนี้เป็นเพียง **technical runtime readiness** ของ PostgreSQL และ API ไม่ใช่ UAT หรือการอนุมัติเปิดใช้จริง ระบบมีฐานข้อมูลว่างตามเจตนา และ agent ไม่ได้สร้างบัญชี ผู้ป่วย เวชระเบียน ยา รายการเงิน หรือข้อมูลตัวอย่างใด ๆ

ก่อน UAT owner ต้องตั้ง `INITIAL_SETUP_KEY` ใน Vercel ผ่านช่องทาง secret ที่ปลอดภัยสำหรับ production/preview ตามนโยบายการใช้งาน แล้วผู้รับผิดชอบที่คลินิกจึงสร้างบัญชี `SYSTEM_ADMIN` คนแรกและจัดการบัญชีทดสอบเองบนเครื่องคลินิก ห้ามส่ง setup key, password, URI หรือข้อมูลระบุตัวตนในแชต เอกสาร หรือ source control

## Blocker และการตัดสินใจของ owner

Supabase metadata ของ project target ยังแจ้ง advisory ว่า **ตาราง `public` ทั้ง 25 ตารางยังไม่เปิด Row Level Security (RLS)**. เนื่องจาก runtime ใช้ server-side PostgreSQL และยังไม่มี policy ที่ทบทวนแล้ว การเปิด RLS แบบอัตโนมัติอาจทำให้ server workflow หยุดทำงาน จึงไม่ได้มีการเปลี่ยน policy ใน release นี้

| เรื่องที่ต้องตัดสินใจ | สถานะ | ผู้รับผิดชอบก่อน GO–NO-GO |
|---|---|---|
| อนุมัติ RLS/policy และ server-side access review | ยังไม่ตัดสินใจ; ถือเป็น production security blocker | Owner/ผู้รับผิดชอบ security และผู้พัฒนาที่ตรวจ policy |
| UAT หน้างานตาม `docs/uat-checklist.md` | ยังไม่เริ่ม | คลินิก/owner โดยใช้ข้อมูลที่ผู้ใช้กรอกเอง |
| Bootstrap account และ role workflow | ยังไม่เริ่ม เพราะ `setupEnabled: false` | Owner ตั้ง secret และผู้รับผิดชอบคลินิก |
| Private document storage, monitoring, backup/recovery drill และ PDPA/legal certification | ยังไม่ปิดงาน | Owner/ทีมปฏิบัติการและที่ปรึกษาที่เกี่ยวข้อง |

> **ข้อสรุป:** ผ่าน technical P0 สำหรับ Vercel handler และ PostgreSQL aggregate readiness แล้ว แต่ **ยังไม่อนุมัติ GO-LIVE** จนกว่า UAT, RLS/policy decision และ operational/legal controls จะเสร็จหรือได้รับการยอมรับเป็นลายลักษณ์อักษรจาก owner

## References

[1]: https://mor-paul-2143iyc0n-gamerx-99s-projects.vercel.app/ "Vercel direct redeploy used for metadata-only readiness verification"
[2]: https://github.com/gamerx-99/mor-paul/pull/9 "PR #9 — fix(auth): hide readiness database errors"
