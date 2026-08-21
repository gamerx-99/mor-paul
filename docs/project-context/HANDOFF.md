# Clinic HIS — Handoff Guide

>  Single source of truth สำหรับผู้พัฒนาหรือ AI ที่มาเริ่มงานต่อในโครงการ  
>  อัปเดตเมื่อ source code หรือ policy เปลี่ยน

## จุดประสงค์

ให้ผู้ใช้ใหม่เริ่มงานได้เร็ว โดยอ้างข้อมูลใน repository เป็นหลัก อย่าาเชื่อม Wikis หรือ chat history

## ลำดับการอ่าน

1. `docs/DEPLOY_SUPABASE_VERCEL.md` — deployment topology + env vars
2. `docs/project-context/SYSTEM_ARCHITECTURE.md` — runtime topology + security boundaries
3. `docs/project-context/DATABASE_SPEC.md` — schema, enums, indexes, RLS
4. `docs/operations-readiness-runbook.md` — backup, recovery, incident
5. `docs/uat-checklist.md` — UAT scenarios + acceptance criteria
6. `docs/uat-verification-evidence.md` — ผล UAT ที่ผ่าน

## Coding Rules

- ใช้ TypeScript เสมอ ห้าม any ที่ไม่จำเป็น
- ทุก mutation ต้องมี audit event (`withAudit` / explicit insert)
- ห้าม seed, mock, หรือ hardcode PHI
- National ID เข้ารหัส write-once masked-only
- RBAC ผ่าน tRPC procedures ห้าม bypass
- ทดสอบด้วย `pnpm check && pnpm test && pnpm build` ก่อน commit

## Git Workflow

- Branch จาก `main`
- 1 logical change ต่อ 1 commit
- ห้าม push จนผ่าน 3 gates: code review / system green / PDPA check

## Contact & Approvals
 
- Escalation: Clinic System Admin (Internal Escalation)
- Operations Sign-off: Designated Clinic Lead Approver
