# F14 Inventory: ledger และ concurrency foundation

ขอบเขต: F14 เท่านั้น ไม่เปลี่ยน order/void transitions, payment หรือ permission grants ไม่ deploy และไม่รัน seed/reset ข้อมูลจริง

## ข้อสรุปเรื่อง prerequisite

อ่าน `IngredientsService.adjustStock`, Ingredient/Recipe models, OrdersService, void endpoint, socket gateway และหน้า ingredients รวมถึงรายงานงาน 03 (`F06_F08_F09_F13_WORKFLOW_*`) แล้ว

พฤติกรรมที่โค้ดงาน 03 บังคับอยู่: item เดินหน้า PENDING → PREPARING → SERVED; header PENDING → CONFIRMED เปลี่ยน PENDING items เป็น PREPARING; เสิร์ฟครบอาจ confirm header อัตโนมัติ; void เฉพาะ PENDING/PREPARING ของ order ที่ไม่ CANCELLED และสร้าง actor/reason audit ใน transaction; cancellation ยังปิดไว้

ไม่พบหลักฐานอนุมัติจุดตัด stock, เงื่อนไขคืนเมื่อ void, หรือการยืนยันหน่วย recipe เดิม จึงไม่ผูก deduction/restoration กับ OrdersService และไม่ถือว่า acceptance เรื่องตัด/คืนตาม order เสร็จแล้ว ตามข้อยกเว้น architecture + tests ที่ผู้ใช้กำหนด

## สิ่งที่ implement แล้ว

- `StockMovement`: reference, type, reason, signed quantity, unit snapshot, balanceAfter, actorId, occurredAt/createdAt และ sequence สำหรับเรียง ledger; unique `(ingredientId, reference)`; DB trigger ห้าม UPDATE/DELETE ประวัติ
- Migration เพิ่ม opening snapshot เท่ากับยอดเดิมทุก ingredient ไม่ reset/recalculate ยอดจาก order เก่า actor ของ migration เป็น null พร้อม reason ระบุแหล่งที่มา; สร้าง ingredient ผ่าน API จะสร้าง opening พร้อม authenticated actor ใน transaction เดียวกัน
- Seed สำหรับข้อมูลใหม่สร้าง opening ledger ด้วย โดยไม่ได้รัน seed ในงานนี้ ไม่เดาหน่วย recipe หรือ threshold ให้ข้อมูล seed
- Manual adjustment ใช้ PostgreSQL `SELECT ... FOR UPDATE` ก่อนอ่านยอด/ตรวจ reference จากนั้น update balance และ insert ledger ใน transaction เดียวกัน; คำขอต่าง reference บน ingredient เดียวกันรอ lock แทน read-modify-write พร้อมกัน
- Retry reference เดิมที่ amount/reason/actor ตรงกันไม่ปรับยอดหรือ emit ซ้ำ คืนข้อมูล ingredient ปัจจุบัน; ใช้ reference เดิมแต่ payload/actor ต่างกันตอบ 409
- คงกติกาเดิม stock ห้ามติดลบ เพิ่ม CHECK constraint; ใช้ Decimal arithmetic ที่ precision 100 เฉพาะ stock โดยไม่เปลี่ยน global precision ของ money; ตรวจขอบเขต numeric(65,30) ของ adjustment
- PATCH metadata ไม่รับ currentStock/unit เพื่อปิดทางข้าม ledger และป้องกันการตีความประวัติด้วยหน่วยใหม่; ingredient ที่มีประวัติลบไม่ได้ (409/FK RESTRICT)
- GET `/ingredients/:id/movements` อ่านประวัติตาม sequence และ GET `/ingredients/:id/reconciliation` เปรียบเทียบ SUM(quantity รวม opening) กับ currentStock ภายใต้ row lock เดียวกัน ใช้ `ingredients.read` ตาม resource guard เดิม
- `reorderThreshold` เป็นค่าปริมาณจริงในหน่วย ingredient, บันทึกใน DB; null = ยังไม่ตั้งค่า, ไม่สร้างตัวเลข default ให้ธุรกิจ; low stock เมื่อ balance <= threshold หลัง movement ที่ลด stock commit แล้วเท่านั้น ไม่เทียบกับยอดก่อนหน้า ไม่ emit เมื่อ replay/rollback/เติม stock
- UI ตั้ง threshold ได้ แสดงค่าและสถานะ unconfigured ชัดเจน ใช้ threshold เดียวกับ backend และส่งจำนวนเพิ่ม/ลดแทนการคำนวณจาก snapshot เก่า มี UUID ต่อ submission และใช้ UUID เดิมเมื่อ retry payload เดิมใน dialog

## Recipe architecture ที่ยังไม่เขียน stock

`recipe-stock-plan.ts` เป็น pure planning ไม่มี workflow caller หรือ stock side effect:

- ต้องระบุ Recipe.quantityUnit ชัดเจน; migration ปล่อย recipe เก่าเป็น null เพื่อให้ตรวจข้อมูลจริงก่อนใช้งาน
- แปลง kg ↔ g และ l ↔ ml; หน่วยตรงกันใช้ได้ รวมหน่วยนับเฉพาะที่สะกดตรงกัน
- ปฏิเสธ mass ↔ volume, pack ↔ piece, หน่วย/alias ที่ไม่ได้ระบุ, quantity <= 0 หรือ nonfinite และ recipe ว่าง; ไม่เดา density/pack size/alias ภาษาไทย
- คูณจำนวน portions และรวม ingredient แล้วเรียง ingredientId สำหรับกำหนด lock order ใน integration ภายหลัง
- แผน full restoration กลับเครื่องหมายจาก original deduction snapshot ไม่อ่านสูตรปัจจุบัน เป็นตัวอย่าง architecture เท่านั้น ยังไม่อนุญาต return, partial return หรือ trigger จาก void

## Acceptance และหลักฐาน

| Acceptance | ผลที่ตรวจได้ |
| --- | --- |
| retry ไม่ตัดซ้ำ | PASS สำหรับ manual adjustment: 10 คำขอพร้อมกัน reference เดียว + retry เหลือ movement เดียว; HTTP duplicate 8 คำขอได้ผลครั้งเดียว |
| concurrent adjustments ไม่ lost update | PASS PostgreSQL: 20 parallel debits และ mixed credits/debits; HTTP 8 distinct requests; balanceAfter ทุกแถวตรง running sum |
| insufficient stock | PASS สองคำขอลด 7 จากยอด 10 สำเร็จเพียงหนึ่ง อีกคำขอไม่เหลือ ledger; ยอดสุดท้าย 3 |
| ledger reconciliation ตรง balance | PASS รวม opening, adjustments, rollback และข้อมูล precision สูงกว่า 20 หลัก |
| low stock ที่ threshold จริง | PASS 1000 → 100 ไม่แจ้งเมื่อ threshold=20; 100 → 20 แจ้ง; retry ไม่แจ้งซ้ำ; threshold null ไม่แจ้ง |
| void คืนครั้งเดียวตาม rule | **รอ business rule**; test ยืนยัน confirmation และ void/retry ไม่เพิ่ม movement หรือเปลี่ยนยอดเอง; void audit ยังคงครั้งเดียว |
| recipe deduct ตาม transition | **รอ business rule/verified units**; pure conversion/plan tests ผ่าน แต่ยังไม่มี production deduction |

หลักฐานใน `inventory-evidence/`:

- `unit.log`: Inventory unit 8/8 PASS
- `postgres.log`: PostgreSQL/service/HTTP integration 10/10 PASS รวม precision, rollback, parallel requests และไม่มี stock side effect จาก confirmation/void
- `workflow-unit.log`: งาน 03 transition regression 25/25 PASS
- `migrations.log`: deploy บน DB ใหม่ที่ลง migration เก่าก่อน ใส่ legacy fixture ยอด 123.45 แล้ว migrate F14; ยอดและ opening ตรงกัน, threshold null; deploy ซ้ำไม่เพิ่ม opening
- `backend-build.log`, `frontend-build.log`: PASS
- `lint.log`, `frontend-lint.log`: ไฟล์ที่แก้ผ่าน ไม่มี errors/warnings (ไม่รวม ingredients.module.ts ที่ไม่ได้แก้)
- `backend-types.log`: full-repo tsc ยัง FAIL จาก test เดิม `kitchens/kitechens.controller.spec.ts` ที่อ้างไฟล์ไม่มี และ `user/user.controller.spec.ts` ที่อ้างชื่อ export ผิด; ไม่แก้นอก scope

HTTP integration ใช้ Nest/ValidationPipe/Prisma จริง แต่ inject authenticated actor fixture ที่ guard ไม่ใช่การทดสอบ JWT/permission ซ้ำ; socket assertion ใช้ gateway spy เพื่อยืนยัน payload/เวลา emit ไม่ใช่ network delivery

ทดสอบเฉพาะ DB ชื่อ `shabu_inventory_<timestamp>` บน test container `127.0.0.1:55432` ไม่แตะ DB application, ไม่ drop/reset/truncate ฐานเดิม; เก็บ DB ทดสอบไว้ทุกครั้ง เครื่องมือต้อง opt in `ALLOW_SHABU_TEST_DB=1` และตรวจชื่อ/host/port ก่อนเชื่อมต่อ metadata URL อยู่ใน `inventory-evidence/test-database.json` ซึ่งถูก gitignore

รันซ้ำจาก backend: `ALLOW_SHABU_TEST_DB=1 npm run test:inventory:db` (ใช้ SHABU_TEST_ADMIN_URL หรือ metadata ฐานทดสอบงาน 03), `npm run test:inventory`, `ALLOW_SHABU_TEST_DB=1 npm run test:inventory:e2e`, `npm run test:workflow`, `npm run build`; frontend ใช้ `npm run build`

## ตัวเลือกที่ต้องยืนยันก่อนผูก order/void

| ประเด็น | ตัวเลือกและผล |
| --- | --- |
| จุดตัด | สร้าง order: จอง/ตัดทันที ก่อนครัวเริ่ม; เข้า PREPARING: ตัดเมื่อเริ่มทำ ครอบคลุมทั้ง header confirm และราย item; SERVED: ตัดเมื่อเสิร์ฟ แต่ยังไม่กัน stock ระหว่างเตรียม |
| การใช้ CONFIRMED | ห้ามถือว่า header CONFIRMED เป็นเหตุการณ์เริ่มทำเสมอ เพราะงาน 03 อาจ confirm เมื่อเสิร์ฟครบ; ต้องกำหนด logical business event ต่อ item เพื่อกันการตัดซ้ำระหว่างสองเส้นทาง |
| คืนเมื่อ void | ไม่คืนเลย; คืนเฉพาะรายการที่ยังไม่เริ่มใช้วัตถุดิบ; หรือคืนเมื่อ manager ยืนยันว่ากู้วัตถุดิบได้ พร้อม audit; การ void PENDING ซึ่งยังไม่เคยตัดต้องไม่สร้างเครดิต |
| ปริมาณคืน | เต็มจำนวนตาม original deduction snapshot หรือคืนบางส่วนพร้อม waste record; ไม่ใช้สูตรที่ถูกแก้ภายหลัง |
| stock ไม่พอ | ใช้กติกาเดิมห้ามติดลบและ reject transition ทั้งชุด หรือแยก reservation/backorder; การอนุญาตติดลบจะขัดกับ constraint ปัจจุบัน ต้องอนุมัติชัดเจนก่อนเปลี่ยน |
| หน่วย | ยืนยัน quantityUnit ต่อ recipe, canonical ingredient unit, alias, density/pack size ที่ธุรกิจใช้จริง และวิธีจัดการเมนูไม่มี recipe |

เมื่ออนุมัติแล้ว integration ควร lock order ตามงาน 03 → lock ingredients ตาม id → สร้าง event reference ที่คงที่จาก item/transition → บันทึก snapshot และ balance/ledger ใน transaction เดียวกับ transition/audit; restoration ต้องอ้าง deduction เดิมและมี unique reference ต่อ return event ภายใต้ lock เดียวกัน พร้อม tests duplicate confirm/item transition/void/partial return ตาม rule ที่เลือก

## ข้อจำกัดการใช้งาน

- API stock ต้องส่ง `reference` UUID ใหม่ต่อเหตุการณ์จริงและใช้ซ้ำตอน retry; client เดิมที่ไม่ส่ง reference ต้องอัปเดตพร้อม backend การปิด/reload dialog ไม่ได้เก็บ pending request ข้าม browser session
- Migration จะปฏิเสธข้อมูลติดลบเดิมเพื่อให้ operator ตรวจ ไม่แก้ยอดให้เอง; ต้องตรวจ backup/migration ตามขั้นตอน deploy จริงก่อนใช้งาน ไม่มี production migration ในงานนี้
- low stock ใช้ post-commit socket เดิม ไม่มี durable outbox; network/process failure หลัง commit อาจทำให้พลาด notification แม้ ledger/balance ถูกต้อง การ retry stock ไม่ replay socket event
- DB admin/raw SQL ยังสามารถเปลี่ยน Ingredient โดยข้าม service ได้; reconciliation ตรวจพบความต่าง ไม่ซ่อมหรือ reset ยอดเอง ข้อมูลประวัติก่อน migration แสดงเป็น opening snapshot เท่านั้น
