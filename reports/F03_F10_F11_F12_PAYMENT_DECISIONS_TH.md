# Payment-critical decisions — ยังไม่อนุมัติ

ฐานตรวจ: commit e54456b; working tree สะอาดก่อนเริ่ม ไม่ deploy แม้ local tests ผ่าน

| เรื่อง | คำตอบที่ต้องอนุมัติ | ส่วน implementation ที่ยังไม่เปิด |
|---|---|---|
| ราคาบุฟเฟต์ | snapshot ตอนเปิดโต๊ะหรือราคา ณ checkout; เปลี่ยน tier ระหว่างทานได้หรือไม่ | authoritative quote/สร้าง invoice ใหม่ |
| ผู้ใหญ่/เด็ก | เกณฑ์เด็ก/ฟรี, จำนวนแก้ได้ถึงเมื่อใด, ผู้ใดแก้ได้ | pricing snapshot/backfill สำหรับ session เดิม |
| ส่วนลด | บาท/เปอร์เซ็นต์, สิทธิ์/เพดาน, ลำดับก่อนหรือหลังภาษี | บังคับใช้ action แยกได้ แต่ไม่กำหนด role grants หรือสูตรเอง |
| VAT/service/rounding | inclusive/exclusive, อัตรา, ลำดับคำนวณ, ปัดต่อบรรทัดหรือทั้งบิล, rounding mode | สูตรจริงและ expected receipt fixtures |
| แยกบิล | invoice เดียวต่อ session หรือ split/partial payments | UNIQUE(invoice.sessionId) และ final-settlement constraints |
| Overdue | มีค่าปรับ/ต่อเวลาหรือไม่, ordering timeout → unpaid → settled → cleaning → available อย่างไร | state machine ใหม่และ expired checkout |
| รับเงินจริง | manual หรือ provider webhook; actor/หลักฐาน/verification/reversal policy | PAID transition และ paid-only revenue |
| ประเภท QR | บุคคล/merchant/bill-payment, ผู้ให้บริการ/spec/version, recipient และ amount fixtures | generator/decoder/provider adapter และ QR endpoint |

## แผนส่วนที่ทำได้โดยไม่เดากติกา

1. ปิด legacy POST /invoices ด้วย 503 CHECKOUT_POLICY_PENDING หลัง AuthN/AuthZ แทนคำนวณ/ปิด session จากยอด client; UI แจ้งข้อจำกัดและไม่แสดง phone-as-payment-QR
2. ส่วนลดต้องมี explicit invoices.discount action เพิ่มจาก invoices.write โดยไม่มี role grants ใหม่; ไม่มีสิทธิ์ตอบ 403 แม้แก้ UI เอง
3. เปิดโต๊ะใช้ transaction, row lock/conditional claim และ partial unique active-session/table; preflight migration ต้องหยุดเมื่อข้อมูลเดิมขัดกัน ไม่เลือก session ที่จะลบทิ้งเอง
   ระหว่างไม่มี settlement state ที่เชื่อถือได้ โต๊ะที่มี session เก่าทุกสถานะต้องตรวจชำระก่อนเปิดใหม่ ไม่ใช้ CLOSED หรือ invoice เดิมเป็นหลักฐาน PAID แม้มีคนเปลี่ยน Table.status กลับ AVAILABLE ก็ยังถูก hold ไว้ (409); เป็นข้อจำกัดชั่วคราว ไม่ใช่ state machine ธุรกิจที่อนุมัติ
4. เก็บ payment settings ใน DB, validate รูปแบบ config ทั่วไป, actor จาก server และคง access guard เดิม; ค่านี้ยังไม่ใช่ผู้รับที่ยืนยันโดย provider
5. เพิ่ม read-only quote/payment readiness response ที่ระบุชัดว่า policy ยังไม่พร้อม ไม่ส่งยอดเดา
6. สร้าง local/test DB ใหม่และทดสอบ empty/populated migration, concurrency/rollback, restart persistence, safe-deny/auth และ proposal fixtures แยกจาก acceptance การชำระจริง

## State/ข้อมูลที่เสนอสำหรับงานถัดไปหลังอนุมัติ

- แยก orderingStatus กับ settlementStatus และ table occupancy; ห้ามตีความ EXPIRED/Invoice exists เป็น PAID
- pricing snapshot: policyVersion, priceBasis, unit prices/counts, currency, taxes/service/rounding breakdown, quote hash/version; snapshot เดิมที่พิสูจน์ย้อนหลังไม่ได้ต้อง UNKNOWN/REVIEW_REQUIRED ห้ามเติมราคาวันนี้เป็นราคาในอดีต
- invoice/payment attempt: idempotency key ที่ unique ตาม operation/actor/session และ canonical request hash; key เดิม/ข้อมูลเดิมคืนผลเดิม, key เดิม/ข้อมูลต่างกัน 409; commit attempt + invoice + settlement ใน transaction เดียว
- split bill ไม่อนุมัติจึงยังไม่ใส่ unique sessionId; หลังอนุมัติจึงเลือก single-invoice constraint หรือ outstanding-balance/line allocation locking
- payment confirmation append audit actor/provider transaction reference, verified recipient/currency/amount และ anti-replay; QR creation เปลี่ยนได้เพียง payment-request state ไม่ใช่ PAID
- session ที่มีข้อมูลเก่าต้อง reconciliation report ก่อน enforce constraints/ย้าย financial status; ไม่แก้ยอด/ลบ invoices/ปิดยอดให้เอง

## แหล่งอ้างอิง

[Thai QR Payment Standard ของ ธปท.](https://www.bot.or.th/content/dam/bot/documents/th/our-roles/payment-systems/about-payment-systems/ThaiQRCode_Payment_Standard.pdf) มีโครงสร้าง payment payload และหลายรูปแบบการชำระ จึงไม่เลือก profile/provider จากเลขโทรศัพท์เพียงอย่างเดียว

[Prisma v7 transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions) ใช้ประกอบแผน atomic writes, conflict handling และ idempotency; unique constraint ต้องสอดคล้องกับ business semantics ที่อนุมัติก่อน
