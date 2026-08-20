# ADR-002: Production Technology Stack สำหรับ Clinic HIS

**สถานะ:** Proposed — รอเจ้าของระบบอนุมัติก่อนเชื่อม cloud account และข้อมูลจริง  
**วันที่:** 20 สิงหาคม 2026  
**ผู้ตัดสินใจที่เสนอ:** Manus AI

## Decision

เลือกสแตกแบบ **Google Cloud–centred, PostgreSQL-first** ดังตารางต่อไปนี้

| ชั้นระบบ | เทคโนโลยีที่เลือก | หน้าที่และเหตุผล |
|---|---|---|
| Web client | React 19, TypeScript, Vite, Tailwind, shadcn/ui | ใช้ต่อจาก workbench ปัจจุบัน; แยก UI จาก policy ที่มีสิทธิ์สูง |
| Identity | Firebase Authentication | Login ของบุคลากร และ short role claims สำหรับการ render UI/การตรวจซ้ำฝั่ง service; claims ต้องออกจาก privileged server เท่านั้น [1] |
| Privileged API | Cloud Run + TypeScript + Fastify | endpoint เดียวสำหรับ PHI, validation, workflow state, audit และ idempotency; Cloud Run รัน container และเชื่อมกับ Firebase Hosting ได้ [2] |
| Core database | Cloud SQL for PostgreSQL | โมเดลข้อมูล HIS, stock และ billing เป็น transactional/relational; รองรับ Cloud Run, encryption, IAM database authentication, network controls และ automated recovery features [3] |
| Private documents | Cloud Storage | เก็บเอกสารหลัง authenticated upload, validation และ scan workflow; ห้าม public bucket และห้ามคืน permanent public URL |
| Async / events | Cloud Tasks หรือ Pub/Sub; Cloud Functions เฉพาะ trigger สั้น | แยกงาน retryable เช่น scan, notification หรือ generate report ออกจาก API request; Cloud Functions ใช้ event/HTTPS/schedule ได้ แต่ไม่เป็น main domain API [4] |
| Audit / observability | PostgreSQL append-only audit table + Cloud Logging/Monitoring | ใช้ audit ที่ query ได้คู่กับ application logs; งดบันทึก PHI ใน log |
| Infrastructure | Terraform หรือ gcloud scripts + versioned SQL migrations | แยก dev/staging/production, ทำสิทธิ์/infra ซ้ำได้ และ review ได้ |

> **คำตัดสินสำคัญ:** ห้ามให้ browser เข้าถึงตารางเวชระเบียน, diagnosis, medication order, stock adjustment, invoice หรือ private document โดยตรง แม้มี Firebase Rules หรือ RLS อยู่แล้วก็ตาม เส้นทางเหล่านี้ต้องผ่าน Cloud Run API เพื่อบังคับ workflow, idempotency, audit และความสอดคล้องของธุรกรรมในจุดเดียว

## เหตุผลในการเลือก

การใช้งานของคลินิกมี transaction ที่ผูกกัน เช่น encounter, SOAP note, ใบสั่งยา, สต็อก, invoice และ payment จึงเหมาะกับ relational database และ ACID transaction มากกว่า document store ที่เป็นแกนหลัก การเลือก PostgreSQL ทำให้ foreign key, transaction boundary, migration, reporting และ audit query เป็นโครงสร้างปกติของระบบ โดย Cloud SQL มีการเชื่อมต่อกับ Cloud Run, automatic backups/point-in-time recovery และ security controls ที่จำเป็นต่อการออกแบบ production [3]

Firebase Authentication เหมาะกับชั้น identity ที่ต้องการเริ่มเร็ว โดย role claim มีไว้ตัดสิน access scope แบบกะทัดรัดและสามารถตรวจซ้ำได้ผ่าน ID token; เอกสาร Firebase ระบุชัดว่า claims ควรกำหนดโดย privileged server และไม่ควรใช้เก็บข้อมูล profile หรือข้อมูลทั่วไป [1] การใช้ Cloud Run เป็น API ชั้นกลางจึงช่วยกันการ bypass rule, คุม signing workflow และรักษา service credentials นอก browser

## ทางเลือกที่ประเมิน

| ทางเลือก | เหมาะเมื่อ | ข้อจำกัดสำหรับงานนี้ | ข้อสรุป |
|---|---|---|---|
| **Firebase + Firestore + GAS** | prototype ที่ข้อมูลไม่ซับซ้อนและไม่มีธุรกรรมการเงิน/สต็อกจริง | core data มีความสัมพันธ์และ transaction มาก; GAS quota/operational model ไม่เหมาะเป็น privileged domain backend | ไม่เลือกเป็น production core |
| **Supabase (Auth + Postgres + RLS + Storage)** | ทีมต้องการ Postgres-first platform ที่ setup เร็วและเข้าใจ RLS ดี | RLS แข็งแรงแต่ต้องดู grants/policy ทุก operation อย่างเข้มงวด; service key bypass RLS ได้ จึงยังต้องมี privileged API [5] [6] | เป็นตัวเลือกสำรองที่ดี หากองค์กรมี Supabase expertise หรือสัญญา data residency/BAA ที่เหมาะสม |
| **React + Firebase Auth + Cloud Run + Cloud SQL + Cloud Storage** | ต้องการใช้ Google ecosystem และ backend policy ที่ควบคุมได้ชัด | ต้องเปิด Cloud Billing และต้องมีผู้รับผิดชอบ Google Cloud IAM/operational cost | **เลือก** |
| **Self-hosted Kubernetes / VM + Postgres** | มีทีม SRE และต้องควบคุม infra ทั้งหมด | ภาระ patch, backup, monitoring และ incident response สูงเกิน clinic ขนาดเล็ก | ไม่เลือกในระยะเริ่มต้น |

## ขอบเขตของ Google Apps Script

Google Apps Script ไม่อยู่ในเส้นทาง PHI หรือธุรกรรมหลักของระบบ อาจใช้ภายหลังเฉพาะงานสนับสนุนที่ข้อมูลไม่ระบุตัวบุคคล เช่น สร้าง template รายงานภายในหรือแจ้งเตือนการดูแลระบบ โดยไม่ใช้ service account หรือ spreadsheet เป็นฐานข้อมูลเวชระเบียน

## เงื่อนไขก่อนเริ่ม integration จริง

ต้องสร้าง Google Cloud organization/project ที่องค์กรเป็นเจ้าของ, แยก environment อย่างน้อย staging/production, เปิด billing และกำหนด IAM owner/backup owner ที่เป็นบุคลากรของคลินิก ก่อนส่ง PHI ใด ๆ เข้าสู่ระบบ ควรให้ผู้รับผิดชอบด้านกฎหมาย/PDPA และผู้ดูแลความมั่นคงสารสนเทศของคลินิกตรวจ data-processing agreement, data residency, retention และ incident process ก่อน pilot เพราะการเลือก platform เพียงอย่างเดียวไม่ทำให้ระบบ compliant โดยอัตโนมัติ

## References

[1]: https://firebase.google.com/docs/auth/admin/custom-claims "Firebase: Control Access with Custom Claims and Security Rules"
[2]: https://firebase.google.com/docs/hosting/cloud-run "Firebase Hosting: Serve dynamic content and host microservices with Cloud Run"
[3]: https://cloud.google.com/sql/postgresql "Cloud SQL for PostgreSQL"
[4]: https://firebase.google.com/docs/functions "Cloud Functions for Firebase"
[5]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase: Row Level Security"
[6]: https://supabase.com/docs/guides/storage/security/access-control "Supabase: Storage Access Control"
