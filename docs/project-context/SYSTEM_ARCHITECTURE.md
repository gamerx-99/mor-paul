# System Architecture

## แนวทางสถาปัตยกรรม

ระบบใช้สถาปัตยกรรม full-stack แบบ lean อยู่ในโครงการเดียวกัน โดยเลือกเทคโนโลยีขั้นต่ำเพื่อรองรับคลินิกขนาดเล็กและหลีกเลี่ยงการเพิ่ม cloud service ที่ไม่มีความจำเป็นตาม ADR-003

```text
React 19 + TypeScript + Tailwind 4
        │  tRPC / Superjson (same-origin)
        ▼
Express 4 application server
        │  Drizzle ORM + mysql2
        ▼
MySQL/TiDB-compatible managed database
```

## Technology Stack

| ชั้น | เทคโนโลยีที่ใช้จริง | บทบาท |
|---|---|---|
| Client | React 19, TypeScript, Vite | UI และ state ของหน้าจอ |
| Styling/UI | Tailwind CSS 4, shadcn/ui, framer-motion | design tokens, component และ interaction |
| Routing | wouter | route ภายในเว็บแอป |
| API | Express 4, tRPC 11, Superjson | typed procedure และ API contract |
| Data access | Drizzle ORM, `mysql2` | schema/query/transaction กับฐานข้อมูล |
| Authentication | Node.js `crypto.scrypt`, opaque session token | local account, password hashing และ session |
| Test/build | Vitest, TypeScript, Vite/esbuild, pnpm | regression test และ production build |
| Hosting | Project autoscale hosting | checkpoint ที่สำเร็จเผยแพร่ตามการตั้งค่าโครงการ |

## สิ่งที่ตั้งใจไม่ใช้ใน MVP

ไม่ใช้ Firebase, Supabase, Google Apps Script, Cloud Run, Cloud SQL, Redis, message queue หรือ external identity provider สำหรับ workflow หลัก และยังไม่มี document/file storage สำหรับ PHI

## Boundary หลัก

| Boundary | ข้อกำหนด |
|---|---|
| Browser → API | ใช้ tRPC procedure; ห้ามตัดสินสิทธิ์จากการซ่อนเมนูใน browser เพียงอย่างเดียว |
| API → Database | query helper และ transaction ฝั่ง server เป็นจุดบังคับ RBAC/workflow/idempotency |
| Auth | token ดิบอยู่ใน cookie เท่านั้น; ฐานข้อมูลเก็บ SHA-256 token hash |
| Password | ฐานข้อมูลเก็บ scrypt-derived password hash; ไม่เก็บรหัสผ่านดิบ |
| National ID | เก็บ ciphertext AES-256-GCM และ HMAC lookup hash; client-facing response ห้ามคืนค่าเต็ม |
| Smart Card | เว็บใช้ browser-side local bridge contract เท่านั้น; ไม่เข้าถึง USB/driver จาก web app โดยตรง |

## Component และเส้นทางสำคัญ

| ความรับผิดชอบ | path/file |
|---|---|
| tRPC root router และ auth | `server/routers.ts` |
| routers ตาม domain | `server/routers/frontDesk.ts`, `doctorConsole.ts`, `pharmacy.ts`, `reports.ts`, `staff.ts` |
| DB helpers/transactions | `server/db.ts` |
| Schema/migrations | `drizzle/schema.ts`, `drizzle/migrations/` |
| Shared domain types | `shared/clinic-domain.ts` |
| Routes ของ UI | `client/src/App.tsx` |
| Navigation/layout | `client/src/components/DashboardLayout.tsx` |
| Mobile viewport hook | `client/src/hooks/useMobile.tsx` |

## ข้อสังเกตสำหรับผู้พัฒนาต่อ

schema ปัจจุบันใช้ integer identifiers และความสัมพันธ์เชิงตรรกะผ่าน query/transaction ใน application layer ตารางใน `drizzle/schema.ts` ไม่ได้ประกาศ foreign key constraint ใน schema ที่ตรวจสอบแล้ว ดังนั้นการเปลี่ยน workflow ต้องรักษา transaction, unique index และ state transition ใน server อย่างเคร่งครัด

