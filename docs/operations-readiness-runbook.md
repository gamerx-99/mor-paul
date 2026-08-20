# Operations Readiness Runbook — Clinic Mor Phallop HIS

เอกสารนี้กำหนดการควบคุมก่อนเริ่ม UAT หรือ pilot ด้วยข้อมูลจริงของคลินิก โดยใช้สแตกขั้นต่ำที่มีอยู่และไม่เพิ่มบริการภายนอก ระบบไม่สร้าง seed, fixture หรือข้อมูลผู้รับบริการเพื่อผ่านขั้นตอนใด ๆ ผู้รับผิดชอบคลินิกเป็นผู้ดำเนินการกับข้อมูลจริงและบันทึกผลเฉพาะในแบบฟอร์มที่ไม่ใส่ PHI

> **เงื่อนไขห้ามเริ่ม UAT:** หากยังไม่กำหนดเจ้าของระบบ, ผู้เก็บรักษา backup, owner ของ credential และวิธีติดต่อเมื่อเกิดเหตุ ให้หยุดก่อนเริ่ม UAT

## 1. Ownership และ environment separation

| หัวข้อ | Development | Production / UAT | เจ้าของ | หลักควบคุม |
|---|---|---|---|---|
| ฐานข้อมูล | ใช้เฉพาะ environment พัฒนา | ใช้ฐานข้อมูลสำหรับงานจริงแยกจาก development | Clinic system owner | ห้ามคัดลอก PHI จาก production มา development |
| Secret | กำหนดผ่านการตั้งค่า environment เท่านั้น | กำหนดผ่านการตั้งค่า environment เท่านั้น | Credential custodian ที่แต่งตั้ง | ห้าม commit, ส่งในแชต, ticket หรือภาพหน้าจอ |
| บัญชีบุคลากร | ใช้บัญชีที่ได้รับอนุมัติ | ใช้บัญชีจริงตามบทบาท | System owner | SYSTEM_ADMIN เป็น platform/staff/catalog only และไม่มี PHI |
| การเปลี่ยนแปลง | ผ่าน test และ checkpoint | ทำหลังอนุมัติ change owner | Change owner | ทุก change ต้องระบุ rollback checkpoint |

ก่อน UAT เจ้าของคลินิกต้องระบุชื่อผู้ดำรงบทบาทต่อไปนี้ในเอกสารที่เก็บโดยคลินิก: **Clinic system owner**, **credential custodian**, **backup custodian**, **incident lead** และผู้แทนอย่างน้อยหนึ่งคน ผู้ดำเนินการต้องใช้ principle of least privilege และห้ามแชร์ username/password ระหว่างบุคลากร

## 2. ขอบเขตเอกสารและไฟล์

การอัปโหลดเอกสาร, รูปภาพ, บัตรประชาชน, ผลตรวจ, เสียง หรือไฟล์แนบผู้รับบริการ **ยังไม่เปิดใช้ในระบบรุ่นนี้** ดังนั้นไม่มีการรับหรือจัดเก็บไฟล์ PHI ผ่านหน้าจอ Clinic HIS ในช่วง UAT นี้ การไม่เปิดรับไฟล์เป็น default ที่ปลอดภัยกว่า การขยายขอบเขตในอนาคตต้องผ่าน privacy review แยกต่างหาก และต้องมี private object storage, allowlist MIME/extension, จำกัดขนาด, malware scan, server-side authorization, retention policy และ restore test ก่อนเปิดใช้

| รายการควบคุมไฟล์ในรุ่นปัจจุบัน | สถานะ | เหตุผล |
|---|---|---|
| Upload file ที่มี PHI | ปิดใช้งาน | ยังไม่มี workflow และการควบคุม file validation ที่อนุมัติ |
| เก็บไฟล์ใน database | ห้าม | แยก file bytes ออกจากข้อมูล transaction เมื่อมีความจำเป็นในอนาคต |
| Log ชื่อไฟล์/เนื้อหา | ห้ามใน audit | ลดการรั่วไหลของ PHI ใน metadata |
| Backup file attachment | ยังไม่เกี่ยวข้อง | ไม่มี file attachment ที่ระบบรับเข้าในรุ่นนี้ |

## 3. Backup และ recovery

โครงการเว็บ full-stack ประกอบด้วย code, database, secret, integration settings และไฟล์ที่อัปโหลด ดังนั้น source-code download เพียงอย่างเดียวไม่ใช่ backup ที่พอสำหรับการกู้คืนระบบ [1] ผู้มีสิทธิ์ทำ backup ต้องตรวจ in-app notification และอีเมลของบัญชีเจ้าของก่อน เพราะสถานะว่าบัญชีอยู่ในขอบเขตการเปลี่ยนบริการหรือไม่ต้องยึดประกาศดังกล่าวเป็นหลัก [2]

| งาน | ความถี่ขั้นต่ำ | ผู้รับผิดชอบ | หลักฐานที่เก็บ | ข้อควรระวัง |
|---|---|---|---|---|
| ตรวจสถานะ account notice | ก่อนเปิด UAT และเมื่อมีประกาศ | Clinic system owner | วัน/เวลา/ผู้ตรวจ โดยไม่ใส่ secret | ห้ามคาดเดาสถานะบัญชีแทนประกาศทางการ |
| Task Data Backup | ตามความเสี่ยงของคลินิก และก่อนเปลี่ยนแปลงสำคัญ | Backup custodian | ตำแหน่ง package และเวลาที่ export | ทุก export เป็น point-in-time snapshot ไม่ sync ต่อเนื่อง [1] |
| Final backup | ก่อน pilot หรือก่อนเวลาตามประกาศ | Backup custodian + witness | checklist ที่ลงนาม | ต้องตรวจว่ามี package ครบและไม่เปลี่ยนชื่อไฟล์ [2] |
| Recovery drill | ใน environment ที่ไม่ใช่ production | Backup custodian + incident lead | ผล checklist, เวลา RTO ที่วัดได้ | ห้าม restore snapshot เก่าทับฐานข้อมูล production ที่มีธุรกรรมใหม่ |

หากบัญชีได้รับผลกระทบจากการเปลี่ยนบริการของ Manus, Task Data Backup ต้องทำด้วยขั้นตอนทางการก่อน deadline ที่ประกาศไว้ และการ restore เป็นการดำเนินการครั้งเดียว จึงต้องรวบรวม package ที่ถูกต้องและใหม่ที่สุดก่อนเริ่ม [2] [3] การกู้คืนจะคืนระบบสู่เวลาของ snapshot; ข้อมูลใหม่หลัง snapshot จะไม่อยู่ใน backup นั้น [1]

### Recovery drill แบบปลอดภัย

1. Incident lead ประกาศว่าเป็น **drill** และยืนยันว่าไม่ได้ใช้ฐานข้อมูล production.
2. Backup custodian ตรวจ checksum/สถานะ package และสิทธิ์เข้าถึงโดยไม่ส่ง package หรือ secret ผ่านช่องทางไม่ปลอดภัย.
3. ใช้ environment กู้คืนที่แยกจาก production ตามขั้นตอนผู้ให้บริการ; ห้ามชี้ client ที่ใช้งานจริงไปยังฐานข้อมูลกู้คืน.
4. ตรวจเฉพาะ health check, sign-in, RBAC ของสามบทบาท, database connectivity และการเปิดหน้า empty state; อย่าทำซ้ำธุรกรรมผู้รับบริการเพื่อ drill.
5. บันทึกเวลาเริ่ม/สิ้นสุด, ผลลัพธ์, ข้อบกพร่อง และ decision owner โดยไม่บันทึก HN, ชื่อ, SOAP, prescription หรือ payment detail.
6. หาก drill ไม่ผ่าน ให้หยุด pilot, เปิด incident record และแก้ไขผ่าน test/checkpoint ก่อนกำหนด drill ใหม่.

## 4. Incident response และการหยุดใช้งานฉุกเฉิน

| เหตุการณ์ | การตอบสนองทันที | ห้ามทำ | เกณฑ์กลับมาใช้งาน |
|---|---|---|---|
| สงสัยสิทธิ์เข้าถึงผิด/PHI exposure | หยุด session ที่เกี่ยวข้อง, แจ้ง incident lead, เก็บเวลาและ request identifier | ห้ามส่ง PHI ในแชตหรือ log incident | privacy review และเจ้าของอนุมัติการกลับมาใช้ |
| Password หรือบัญชีเสี่ยง | ปิดใช้งานบัญชีจาก Staff Management, เปลี่ยนรหัสผ่าน, เพิกถอน session | ห้าม reset ด้วย SQL เฉพาะกิจ | ยืนยัน role, audit event และ sign-in ใหม่ |
| Dispense/payment ผิดปกติ | หยุดทำซ้ำ mutation, บันทึก request identifier, ตรวจ audit | ห้าม replay โดยใช้ key ใหม่เพื่อ “แก้” รายการ | ทบทวน idempotency/audit และอนุมัติทางธุรกิจ |
| ระบบไม่พร้อมใช้ | แจ้งผู้ใช้งานให้กลับ workflow กระดาษที่คลินิกอนุมัติ, เปิด incident | ห้ามแก้ข้อมูลย้อนหลังโดยตรงใน database | health check ผ่าน, owner ยืนยันการเปิดใช้ |

การ monitor รุ่นเริ่มต้นเป็นการตรวจแบบ manual ที่มีเจ้าของชัดเจน: สถานะ deployment, error ใน runtime log, sign-in failure spike, database connectivity และเหตุการณ์ rate limit ผู้ตรวจต้องบันทึกเฉพาะ timestamp, component และ outcome; ไม่คัดลอก request body หรือ PHI ลงใน log การปฏิบัติการ

## 5. Go / No-go ก่อน pilot

| เกณฑ์ | ผู้ยืนยัน | สถานะที่ต้องมี |
|---|---|---|
| เจ้าของและ credential ownership ถูกกำหนด | Clinic system owner | ลงนามในบันทึกภายในคลินิก |
| สถานะ backup และ recovery drill ผ่าน | Backup custodian | checklist ไม่เก็บ PHI |
| UAT workflow และ RBAC ผ่าน | ตัวแทน DOCTOR, ASSISTANT, SYSTEM_ADMIN | checklist ครบทุก role |
| ไม่มี critical defect ด้าน PHI/RBAC/audit/idempotency | Incident lead | issue log ปิดหรือมี mitigation อนุมัติ |
| checkpoint ล่าสุดผ่าน check/test/build | Change owner | version ID ที่ระบุได้ |

## References

[1]: https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data "How to Back Up Your Data — Manus Help Center"
[2]: https://help.manus.im/en/articles/16147831-service-change-overview-what-s-happening-and-am-i-affected "What’s Happening and Am I Affected? — Manus Help Center"
[3]: https://help.manus.im/en/articles/16147895-service-change-overview-how-to-restore-your-data "How to Restore Your Data — Manus Help Center"
