# Clinic HIS — Operations Readiness Runbook

>  จัดทำใหม่หลัง migration ไป Supabase + Vercel serverless  
>  แทน docs/project-context/KNOWN_ISSUES.md + เอกสาร readiness เดิม

## 1. Roles & Ownership (P0-01)

| Role | คนterno |
|---|---|
| Clinic system owner | เจ้าของคลินิก |
| Credential custodian | ผู้อำนวยการ / ผู้ช่วย |
| Backup custodian | รับผิดชอบ backup/restore |
| Incident lead | ติดเหตุ, บันทึก, esate |
| ผู้แทน | backup Roles 1-4 |

หลักฐาน: เก็บในคลินิก ( hard copy หรือ encrypted digital)

## 2. Backup & Recovery (P0-02)

|  | Detail |
|---|---|
| Frequency | Supabase managed backup (daily) + manual export before pilot |
| Retention | 30 วัน (ปรับตาม PDPA) |
| Storage | Supabase dashboard backup downloads + encrypted USB |
| Test recovery | ทดสอบ restore บน environment ไม่ใช่ production ก่อน pilot |
| RTO target | < 4 ชั่วโมง |
| RPO target | < 24 ชั่วโมง |

## 3. Recovery Drill (P0-03)

- ทำบน staging/test project
- บันทึก checklist + เวลาที่ใช้จริง
- ผลตัดสินใจ: ผ่าน/ไม่ผ่าน + หมายเหตุ
- ห้ามใส่ PHI ในการทดสอบ

## 4. Incident Response (P0-04)

|  | Detail |
|---|---|
| Path | ตรวจ Supabase logs + audit events |
| Escalation | Clinic owner → credential custodian → incident lead |
| Monitoring | Manual daily log review (ไม่มี auto-alert ในรุ่นแรก) |
| Log format | ไม่รวม PHI — ไม่ส่ง full national ID, address, ฯลฯ |

## 5. Environment

| Environment | URL | Purpose |
|---|---|---|
| Local dev | `http://localhost:3000` | development |
| Production | Vercel preview/production URL | clinic use |

Env vars: ดู `docs/DEPLOY_SUPABASE_VERCEL.md`

## 6. Pre-flight Checklist ก่อนเปิดให้ใช้งานจริง

- [ ] `pnpm check` ผ่าน (0 TS errors)
- [ ] `pnpm test` ผ่าน (≥107 tests)
- [ ] `pnpm build` สำเร็จ
- [ ] Supabase project RLS เปิดใช้งาน
- [ ] Supabase Storage bucket private + path guard ผ่าน
- [ ] Test accounts สำหรับ DOCTOR, ASSISTANT, SYSTEM_ADMIN พร้อม
- [ ] Backup/download test สำเร็จ
- [ ] Incident roles แต่งตั้ง + เก็บหลักฐาน

## 7. Contact & Escalation

| Role | Channel |
|---|---|
| Incident Commander | Clinic System Admin (Internal Escalation) |
| Security & Approval | Designated Clinic Lead Approver |
