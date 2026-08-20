# UI/UX Specification

## ภาษาการออกแบบ

UI ใช้แนวคิด **Clinical Transit Board / workbench** สำหรับการปฏิบัติงานในคลินิก ใช้ภาษาไทยเป็นหลักและให้ความสำคัญกับลำดับงาน ความชัดเจนของสถานะ และพื้นที่ว่างที่เพียงพอ มากกว่าการตกแต่งที่ซับซ้อน

ต้องยึดหลัก Contrast, Alignment, Repetition, Proximity, Hierarchy, White Space, Scale, Balance, Unity และ Consistency ทุกครั้งที่เพิ่มหรือแก้ไขหน้าจอ

## Design Tokens

| Token | ค่า |
|---|---|
| Primary — Transit Teal | `#2E7E86` |
| Secondary — Green | `#79A388` |
| Accent | `#BCC996` |
| Background — Ivory | `#E6ECC8` |
| Danger / Allergy Alert | `#EF4444` |
| Typography | Kanit / Sarabun |

## Layout และ navigation

`DashboardLayout` เป็น shared layout ของหน้าปฏิบัติงาน ใช้ menu ตาม role และมี sidebar ที่ปรับความกว้างได้บน desktop ขณะที่ mobile ใช้ viewport state จาก `useIsMobile` และแสดง header ที่ติดด้านบนของเนื้อหา การแสดงเมนูต้องขึ้นกับ role ใน account จริง แต่ server ยังคงเป็นแหล่งตัดสินสิทธิ์

| Role | เมนู/หน้าที่เห็นจาก navigation |
|---|---|
| `SYSTEM_ADMIN` | คลังยาและราคา, รายงานสรุป, บัญชีบุคลากร; หน้าแรกมี zero-PHI overview |
| `DOCTOR` | ภาพรวม, คัดกรองและคิว, ห้องตรวจ, รายงานสรุป |
| `ASSISTANT` | ภาพรวม, ลงทะเบียน, คัดกรองและคิว, จ่ายยาและการเงิน, รายงานสรุป |

## Page Map

| Route | Page | กลุ่มผู้ใช้ที่มีหน้าที่ใช้งาน |
|---|---|---|
| `/` | Clinical Transit Board / overview | แยกเนื้อหาตาม role |
| `/front-desk` | Front Desk | ASSISTANT |
| `/queue` | Queue Board | DOCTOR, ASSISTANT |
| `/doctor-console`, `/doctor-console/:visitId` | Doctor Console | DOCTOR |
| `/cashier` | Cashier | ASSISTANT |
| `/medications` | Medication Catalog | SYSTEM_ADMIN |
| `/reports` | Reports v1 | ทุก role, aggregate-only |
| `/staff` | Staff Management | SYSTEM_ADMIN |

## UX States และ accessibility

หน้าจอควรแสดง loading, empty และ error state ที่ชัดเจนโดยไม่เผยข้อมูลโครงสร้างระบบหรือ PHI เกินสิทธิ์ ใช้ visible focus ring, keyboard reachability, labels ที่สื่อความหมาย และข้อความสถานะภาษาไทยที่กระชับ

การแสดงตัวเลขหรือข้อมูลสำคัญต้องใช้ contrast เพียงพอกับ background ทุกครั้ง โดยเฉพาะสัญญาณ danger/allergy และปุ่มที่เปลี่ยน workflow ทางการเงิน/คลินิก

## Mobile regression constraint

ปัญหา initial display ของ mobile navigation ถูกแก้แล้วที่ state เริ่มต้นของ viewport hook และมี regression tests ครอบคลุม role ต่าง ๆ การแก้ไขในอนาคตต้อง **ไม่เปลี่ยน routing, navigation logic, callback ของปุ่ม หรือ desktop layout** หากไม่ได้รับข้อกำหนดใหม่อย่างชัดเจน ต้องทำ UAT บนอุปกรณ์จริงก่อนถือว่าปิดงานการแก้ปัญหามือถือได้

