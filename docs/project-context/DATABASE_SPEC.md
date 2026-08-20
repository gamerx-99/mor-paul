# Database Specification

> **Source of truth:** `drizzle/schema.ts` และ migrations ภายใต้ `drizzle/migrations/`  
> ตารางต่อไปนี้อธิบายจาก schema ที่มีอยู่จริง ไม่ได้หมายความว่ามี foreign key constraint ประกาศใน database ทุกความสัมพันธ์

## Identity, Session และ Patient

| Table | Key/ข้อมูลหลัก | ความสัมพันธ์เชิงตรรกะ |
|---|---|---|
| `users` | username unique, passwordHash, displayName, role, active/lock state | อ้างอิงผู้ดำเนินการในหลาย domain |
| `userSessions` | tokenHash unique, userId, expiry/revocation | หลาย session ต่อ user |
| `patients` | HN unique, identity/contact, allergy summary, national-ID secure fields | หนึ่ง patient มีหลาย visits |
| `visits` | patientId, visitDate, chiefComplaint, encounter status, version | จุดศูนย์กลางของ clinical/billing flow |
| `triageRecords` | visitId unique, vital signs, urgency, performedBy | หนึ่ง triage ต่อ visit |
| `queueEntries` | visitId unique, queueDate/number unique, status, assignedTo | หนึ่ง queue entry ต่อ visit |

`patients.nationalIdCiphertext` และ `patients.nationalIdLookupHash` ต้องไม่ถูกเลือกใน client-facing patient query; `nationalIdLookupHash` มี unique index เพื่อป้องกันเลขซ้ำ ข้อมูลเลขบัตรเต็มไม่ควรออกจาก server ผ่าน response ปกติ

## Clinical Record และ Prescription

| Table | Key/ข้อมูลหลัก | ความสัมพันธ์เชิงตรรกะ |
|---|---|---|
| `clinicalNotes` | visitId unique, SOAP fields, DRAFT/SIGNED, revision | หนึ่ง clinical note ต่อ visit |
| `visitDiagnoses` | visitId, code/display, rank unique per visit | หลาย diagnosis ต่อ visit |
| `clinicalOrders` | visitId unique, status/revision/sign metadata | หนึ่ง order header ต่อ visit |
| `medicationOrderItems` | clinicalOrderId, medication snapshot, dose/frequency/quantity | หลาย items ต่อ clinical order |

clinical note และ clinical order ใช้ revision/status เพื่อควบคุมการแก้ไขและ signing workflow ข้อความยาใน order item เป็น snapshot เพื่อไม่ให้ master data ที่เปลี่ยนภายหลังแก้ประวัติคำสั่งที่ลงนามแล้ว

## Catalog, Inventory และ Dispensing

| Table | Key/ข้อมูลหลัก | ความสัมพันธ์เชิงตรรกะ |
|---|---|---|
| `medications` | code unique, generic/trade name, dosage form, strength, isActive | medication master เริ่มว่าง |
| `medicationPrices` | medicationId, unitPriceSatang, effective range, isActive | price history ต่อ medication |
| `inventoryLots` | medicationId + lotNumber unique, expiry, received/remaining quantity | หลาย lot ต่อ medication |
| `stockMovements` | inventoryLotId, movement type/delta, reference, idempotencyKey unique | append-only ledger ต่อ lot |
| `dispensations` | visitId unique, clinicalOrderId unique, status/request metadata | หนึ่ง dispensation ต่อ visit/order |
| `dispensationItems` | dispensationId, medicationOrderItemId, inventoryLotId, quantity | trace การจ่ายจาก order item ไป lot |

สต็อกใช้ lot, expiry และ `remainingQuantity`; transaction จ่ายยาต้องรักษา FEFO, idempotency และ stock movement trace

## Billing, Payment และ Audit

| Table | Key/ข้อมูลหลัก | ความสัมพันธ์เชิงตรรกะ |
|---|---|---|
| `serviceCharges` | visitId, description/detail, quantity, unit price, status | หลายค่าบริการต่อ visit; แยกจากยา |
| `invoices` | visitId unique, invoiceNumber unique, issue request id, status, total | หนึ่ง invoice ต่อ visit |
| `invoiceLines` | invoiceId, source type/id, description/price snapshots | หลาย line ต่อ invoice; source ชี้ยา/บริการ |
| `payments` | invoiceId, method, amount, external reference, idempotencyKey unique | payment ต่อ invoice |
| `invoiceVoids` | invoiceId unique, reason, void metadata | void record ต่อ invoice |
| `auditEvents` | action, actor, role, entity, outcome, requestId, metadata | append-only technical audit trail |

จำนวนเงินใช้หน่วย `Satang` เป็น integer ใน price, invoice และ payment การสร้าง invoice/การรับชำระต้องทำภายใต้ transaction และ idempotency เพื่อป้องกันการคิดเงินซ้ำ metadata ของ `auditEvents` ห้ามคัดลอกเนื้อหาเวชระเบียนหรือข้อมูลระบุตัวผู้รับบริการ

## Lifecycle หลักของ Visit

```text
patients → visits
              ├─ triageRecords
              ├─ queueEntries
              ├─ clinicalNotes + visitDiagnoses
              ├─ clinicalOrders → medicationOrderItems → dispensations → dispensationItems → inventoryLots/stockMovements
              └─ serviceCharges + invoice → invoiceLines → payments
```

สถานะ visit ที่ schema รองรับคือ `REGISTERED`, `TRIAGED`, `WAITING_DOCTOR`, `IN_CONSULT`, `DISPENSING`, `BILLED`, `CLOSED`, `CANCELLED` การปิด `CLOSED` อยู่ภายใต้ billing workflow ไม่ใช่การแก้ status จาก client โดยตรง

