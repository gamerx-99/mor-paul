# Pharmacy UI Verification Notes

ตรวจเมื่อ 20 สิงหาคม 2026 หลังเพิ่ม Pharmacy Foundation และ Cashier v1

| เส้นทาง | ผลตรวจ | ข้อสังเกตด้านข้อมูล |
| --- | --- | --- |
| `/medications` | แสดง Access Gate / System Bootstrap ตามสถานะ session | ยังไม่แสดง catalog หรือข้อมูลผู้รับบริการก่อนยืนยัน session |
| `/cashier` | แสดง Access Gate ตามสถานะ session | ยังไม่แสดงข้อมูลผู้รับบริการหรือรายการรับชำระก่อนยืนยัน session |
| `/doctor-console` | แสดง Access Gate ตามสถานะ session | ยังไม่แสดงข้อมูลผู้รับบริการหรือข้อมูลคลินิกก่อนยืนยัน session |

เส้นทาง Medication Catalog ที่ลงทะเบียนในแอปคือ `/medications` ไม่ใช่ `/medication-catalog`.
