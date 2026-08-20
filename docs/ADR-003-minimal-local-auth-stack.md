# ADR-003: Minimal Stack และ Username/Password สำหรับระยะเริ่มต้น

**สถานะ:** Implemented for prototype / pilot gate  
**แทนที่:** ADR-002 เฉพาะส่วนเลือก technology stack สำหรับระยะเริ่มต้น  
**วันที่:** 20 สิงหาคม 2569

## Decision

ระยะเริ่มต้นของ Clinic HIS ใช้สแตกเพียงสามส่วนที่อยู่ในโครงการเดียวกัน ได้แก่ **React/TypeScript**, **Node.js/Express + tRPC** และ **managed MySQL-compatible database** ของโครงการ โดยไม่ใช้ Firebase, Google Apps Script, Cloud Run, Cloud SQL, Supabase หรือ identity provider ภายนอก

| ความต้องการ | กลไกที่ใช้ | เหตุผล |
|---|---|---|
| หน้าจอ | React/TypeScript/Tailwind | คง Clinical Transit Board และ build pipeline ที่มีอยู่ |
| API | Express + tRPC | same-origin API, contract มี type และไม่ต้องตั้ง REST gateway เพิ่ม |
| บัญชีผู้ใช้ | local username/password | ตรงกับ workflow ที่คลินิกต้องการเริ่มต้น |
| Password storage | Node.js `crypto.scrypt` | ไม่มี native dependency เพิ่ม; เก็บ salt และ derived key เท่านั้น |
| Session | opaque random token ใน HTTP-only, SameSite=Lax cookie; เก็บ hash ของ token ใน database | browser ไม่อ่าน token และ logout/revocation ทำได้จาก server |
| RBAC | role ในตาราง `users` และ protected procedure ฝั่ง server | ไม่พึ่ง role จาก browser; server เป็นผู้ตัดสินสิทธิ์ |
| ข้อมูลหลัก | managed database เดียว | ความสัมพันธ์และ audit query ต่อขยายในฐานข้อมูลเดียว |

## สิ่งที่ตัดออกจาก MVP

ไม่ใช้ Firebase Auth/Firestore/Storage, Cloud Run, Google Apps Script, Supabase, Redis, message queue หรือ password-hashing package เพิ่มในระยะเริ่มต้น เอกสาร/ภาพถ่ายจะยังไม่รับเข้าระบบจริงจนกว่าจะกำหนด private storage, file validation และ backup policy แยกต่างหาก

## Baseline ที่ implement แล้ว

ระบบมี bootstrap ที่สร้าง `SYSTEM_ADMIN` คนแรกได้เพียงครั้งเดียวโดยต้องใช้ `INITIAL_SETUP_KEY` ซึ่งเก็บเป็น secret ฝั่ง server, บังคับ username ที่ normalize แล้ว, password อย่างน้อย 12 ตัวอักษร, scrypt hash, timing-safe setup-key comparison, secure cookie เมื่อผ่าน HTTPS, session อายุ 8 ชั่วโมง, hash session token ในฐานข้อมูล, logout/revocation และการนับ failed login/lock state ใน schema การทดสอบครอบคลุม bootstrap-secret validation และ logout cookie

## ข้อจำกัดและงานก่อนใช้ PHI

นี่เป็น baseline เพื่อเริ่มพัฒนาระบบ ไม่ใช่ใบรับรองความสอดคล้องกฎหมายหรือความพร้อมใช้ข้อมูลสุขภาพจริง ก่อนนำ PHI เข้า ต้องเพิ่มอย่างน้อย: สร้างบัญชี staff โดยผู้ดูแล, enforce role procedure ทุก domain action, rate limiting ที่ขอบเขต deployment, password reset ที่มีการพิสูจน์ตัวตน, audit event ที่ append-only, backup/recovery drill และเอกสาร PDPA/retention ที่ผู้รับผิดชอบคลินิกอนุมัติ
