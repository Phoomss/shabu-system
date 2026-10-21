# แผนและ prerequisite ก่อนแก้ workflow

ฐานที่ตรวจ: commit bb9de25 (working tree สะอาดก่อนเริ่ม)

F04 พร้อมสำหรับ implementation: ID unit tests 30/30 PASS; รองรับ raw UUID/prefixed entity ID และปฏิเสธ display number/malformed ID

F02/F07 พร้อมในระดับกลไก: permission unit 8/8 และ REST/JWT/PostgreSQL/Socket integration 29/29 PASS ก่อนแก้ โดยใช้ test grants เท่านั้น ครั้งแรก sandbox ปฏิเสธ connect EPERM; rerun ด้วยสิทธิ์ local test แล้ว exit 0

**Operational blocker**: permission matrix ยังไม่อนุมัติและ assignment พนักงานต่อครัวต้องกำหนดจริง default-deny คงเดิม ไม่ตั้ง OWNER/MANAGER/STAFF/KITCHEN grants ให้ production การทดสอบ workflow จะใช้ role TEST และ explicit fixture grants/assignments เท่านั้น

ลำดับ: regression tests → service validation/transaction/state rules → secured kitchen events → QR/KDS lifecycle + kitchen API client → integration/regression/build → รายงานหลักฐานจริง

กติกาที่ขอความเห็นเพิ่มเติม: item เดินหน้า PENDING→PREPARING→SERVED, VOIDED ผ่าน audit flow เท่านั้น; CANCELLED ที่ยังมี non-VOIDED items ปฏิเสธเสมอ ไม่ auto-void/refund ระหว่างรอคำตอบจะปิด cancellation ไว้ก่อน ขีดจำกัดเทคนิคที่เสนอ items ≤100 และ quantity 1–99 (ไม่ใช่โควตารอบการทาน)

ไม่แก้ schema/migration/permission grants ไม่ deploy/merge/push และไม่ใช้ฐานข้อมูลจริง
