# หลักฐานประกอบการเลือก Production Stack

เอกสาร Firebase ระบุว่า custom claims ใช้กับ role-based access control และ Security Rules ได้ แต่ต้องกำหนดจาก privileged server environment; backend ต้องตรวจ Firebase ID token ก่อนประมวลผลคำขอ และ claims ไม่ควรเก็บข้อมูล profile/ข้อมูลทั่วไป [1] เอกสารนี้สนับสนุนการใช้ Firebase Authentication เป็นชั้น identity และ role hint ไม่ใช่ฐานข้อมูลเวชระเบียน

Cloud Functions for Firebase เป็น serverless backend ที่ตอบสนองต่อ HTTPS request, Admin SDK, schedule และ event ได้ โดย logic ฝั่ง server ถูกแยกจาก client; อย่างไรก็ตามการ deploy ต้องใช้ Firebase project ที่เปิด billing/Blaze [2] Cloud Run เชื่อมกับ Firebase Hosting ได้ และรองรับ containerized API หลายภาษา แต่ Firebase project ต้องผูก Cloud Billing account ก่อนใช้งาน [3]

Cloud SQL for PostgreSQL เป็น PostgreSQL แบบ managed ที่เชื่อมกับ Cloud Run ได้และรองรับ automatic backups, point-in-time recovery จาก binary logging, encryption at rest/in transit, IAM database authentication, VPC และ network controls [4] คุณสมบัติเหล่านี้เหมาะกับข้อมูลที่มีความสัมพันธ์และธุรกรรมของ HIS เช่น encounter, ใบสั่งยา, สต็อก และการเงิน แม้ยังต้องออกแบบสิทธิ์และ audit อย่างถูกต้องเอง

ผลชั่วคราว: สำหรับ Clinic HIS ให้หลีกเลี่ยง GAS เป็น privileged backend และให้ใช้ **React + Firebase Auth + Cloud Run (TypeScript) + Cloud SQL for PostgreSQL + Cloud Storage** เป็นเส้นทาง production candidate โดย Cloud Functions ใช้กับ event ที่สั้นและไม่ซับซ้อน เช่น provisioning custom claims หรือ file lifecycle hook เท่านั้น

Supabase เป็นทางเลือกที่แข็งแรงสำหรับทีมที่ต้องการ Postgres-first platform: Supabase Auth ใช้ JWT และเชื่อมกับ Row Level Security (RLS) ซึ่งทำ authorization ที่ระดับแถวได้ [5] RLS ป้องกันข้อมูลแบบ defense in depth แต่ต้องเปิด RLS ทุก exposed table, ถอน grants ที่ไม่จำเป็น และเขียน policy แยกตาม operation [6] Storage ก็ใช้ RLS ได้ แต่ service key สามารถ bypass RLS ทั้งหมด จึงต้องเก็บเฉพาะใน trusted backend [7]

การตัดสินใจเชิงสถาปัตยกรรมจึงไม่ใช่เรื่อง Firebase เทียบ Supabase เพียงอย่างเดียว แต่คือ **จะให้ client query ข้อมูลเวชระเบียนโดยตรงหรือไม่** สำหรับระบบนี้ ข้อเสนอคือไม่ว่าเลือก platform ใด ให้ route ที่เขียนหรืออ่าน PHI แบบละเอียดผ่าน privileged API เดียว เพื่อควบคุม encounter state, audit, idempotency, consent และ file scan ได้สม่ำเสมอ ส่วน RLS/Rules ทำหน้าที่เป็นชั้นป้องกันซ้ำ ไม่ใช่ policy engine ชั้นเดียว

## References

[1]: https://firebase.google.com/docs/auth/admin/custom-claims "Firebase Authentication: Control Access with Custom Claims and Security Rules"
[2]: https://firebase.google.com/docs/functions "Cloud Functions for Firebase"
[3]: https://firebase.google.com/docs/hosting/cloud-run "Serve dynamic content and host microservices with Cloud Run"
[4]: https://cloud.google.com/sql/postgresql "Cloud SQL for PostgreSQL"
[5]: https://supabase.com/docs/guides/auth "Supabase Auth"
[6]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security"
[7]: https://supabase.com/docs/guides/storage/security/access-control "Supabase Storage Access Control"
