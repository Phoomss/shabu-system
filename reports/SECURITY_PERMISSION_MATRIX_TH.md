# Permission matrix สำหรับรีวิว F01/F02/F07

สถานะ: **รอการอนุมัติ** ไม่ถือว่าการซ่อนเมนูใน UI เป็น authorization policy ที่อนุมัติแล้ว

หลักฐานปัจจุบัน: seed มี OWNER/MANAGER/STAFF/KITCHEN, UI จำกัด users/roles ไว้ OWNER และ invoices/stock/void logs ไว้ OWNER/MANAGER แต่ไม่มี server permission guard และ schema ไม่มี assignment ผู้ใช้ต่อครัว

| Permission / endpoint-action | OWNER (เสนอ) | MANAGER (เสนอ) | STAFF (เสนอ) | KITCHEN (เสนอ) |
|---|---|---|---|---|
| users.read/write — /users CRUD | ✓ | — | — | — |
| roles.read/write — /role CRUD | ✓ | — | — | — |
| tables.read — GET /tables | ✓ | ✓ | ✓ | — |
| tables.write — create/edit/delete/status | ✓ | ✓ | — | — |
| sessions.read/write — list/detail/open/close | ✓ | ✓ | ✓ | — |
| orders.read/write — staff list/detail/create/status | ✓ | ✓ | ✓ | — |
| orders.void — manager approval | ✓ | ✓ | — | — |
| void-logs.read | ✓ | ✓ | — | — |
| menu.read / tiers.read | ✓ | ✓ | ✓ | — |
| menu.write / tiers.write / categories.read/write | ✓ | ✓ | — | — |
| kitchens.read — list kitchen names | ✓ | ✓ | — | ✓ |
| kitchens.write — configure kitchens | ✓ | ✓ | — | — |
| kitchen.orders.read/write — assigned kitchen only | ✓ | ✓ | — | ✓ |
| ingredients.read/write — inventory + low stock event | ✓ | ✓ | — | — |
| invoices.read/write — invoice/payment/revenue | ✓ | ✓ | — | — |
| payment-settings.read/write — receiver account | ✓ | **รอตัดสินใจ** | — | — |

ทุกบทบาทต้องมี assignment จากฝั่ง server ก่อนอ่าน/แก้รายการหรือ join kitchen room ไม่มีการเดาว่า OWNER/MANAGER ได้ทุกครัวอัตโนมัติ ต้องระบุ user UUID → kitchen IDs ที่อนุญาตจริง

บทบาทอื่นที่มีอยู่/สร้างเพิ่มไม่รับสิทธิ์โดยอัตโนมัติ ต้องกำหนด explicit grant เช่นเดียวกัน

ระหว่างรออนุมัติ: employee APIs ต้อง login และ permission ที่ไม่มี explicit server grant ตอบ 403 สำหรับทุก role รวม OWNER; login/refresh/logout/me ยังคงทำงานได้ ลูกค้ายืนยันจาก QR token เดิมเพื่อแลก signed credential เฉพาะ session โดยไม่ต้อง login พนักงาน

ข้อมูลที่ต้องตัดสินใจ: ยืนยันตารางหรือแก้รายการ, สิทธิ์ MANAGER เปลี่ยนบัญชีรับเงิน, การแก้โครงสร้างโต๊ะของ STAFF และ assignment ของพนักงานต่อครัว
