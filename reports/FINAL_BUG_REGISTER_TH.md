# Final verification — bug / blocker register

Run `run-1792594006532` ใช้ source ใน working tree ล่าสุด รวม staged F15/F16 บน HEAD `dfec755` ทุกกรณีใช้ fixture ไม่ใช่ข้อมูล/เงินของลูกค้าจริง

## BUG-FV-ORDER-RETRY

**OPEN / P1 — F10/F13 และ acceptance retry order**

Reproduce: เปิด session fixture → แลก QR credential → POST `/customer/orders` ด้วย items เดิมและ `Idempotency-Key` เดิมสองครั้งตามลำดับ ครั้งที่สองจำลอง retry หลัง response สูญหาย

Expected: reference เดียวต้องอ้าง operation/resource เดิม ไม่สร้างอาหารเพิ่ม

Actual: HTTP `201, 201`, order IDs ต่างกัน, DB มี **2 orders** แทน 1 ทั้งครั้งแรกและ retest ไม่มีการแก้ expectation เป็น count=2

หลักฐาน: [initial test](final-verification/run-1792594006532/journey.log), [retest](final-verification/run-1792594006532/journey-retest.log), [facts](final-verification/run-1792594006532/journey-retest/journey-facts.json) case `FV-R01`

เป็น capability gap ของ retry acceptance: endpoint ปัจจุบันไม่ได้ประกาศ/รองรับ order idempotency header จึงไม่สรุปว่าเป็น regression ใหม่จาก F15/F16 หรือว่าทุก POST body ซ้ำต้องถูก deduplicate ห้ามใช้ body เท่ากันเป็นตัวตัดสินว่าเป็นการสั่งใหม่หรือ retry โดยไม่มี business-event reference

Follow-up: กำหนด reference contract ที่รองรับ staff/customer แยก scope ตาม actor/session, request hash/conflict และ replay หลัง session ปิด; ทำ unique claim + order + events ใน transaction และทดสอบ concurrent/retry/timeout โดยคงการสั่งรายการเดิมครั้งใหม่ด้วย reference ใหม่ได้ ไม่เพิ่ม protocol/schema นี้เองในงาน final verification

## BUG-FV-QUALITY-LINT

**OPEN / P1 release quality — F16**

Frontend full lint: **33 errors / 43 warnings**; backend full lint retest: **157 errors / 11 warnings** ส่วนใหญ่ legacy typing/formatting/hook diagnostics ไม่เปลี่ยน severity หรือใส่ ignore เพื่อซ่อนปัญหา

หลักฐาน: [frontend](final-verification/run-1792594006532/frontend-lint.log), [backend latest](final-verification/run-1792594006532/backend-lint-retest.log), [new/modified tests lint](final-verification/run-1792594006532/new-tests-lint.log)

Initial backend lint มีอีก 1 unsafe response access ใน test ใหม่ แก้เป็น typed response และ retest แล้ว test files ที่เพิ่ม/แก้ผ่าน lint; full repo ยัง fail ตามจำนวนข้างต้น

Follow-up: แยก PR แก้ source diagnostics ตามหมวดพร้อม behavior regression ห้าม disable lint ทั้ง repo หรือใช้ CI --fix ให้ผลเขียว

## BUG-FV-SCAFFOLD-UNIT

**OPEN / P1 release quality — F16**

`npm test -- --runInBand` ทั้ง backend: **23 failed suites / 12 passed**, assertion tests **22 failed / 83 passed**, ไม่มี skipped tests ส่วนที่ fail เป็น DI scaffolds ที่ไม่มี dependency providers และ stale imports/exports เช่น `kitechens.controller` และ `UserController` ไม่ใช่ business behavior 22 กรณีที่ execute จนผ่าน setup แล้ว

หลักฐาน: [full log](final-verification/run-1792594006532/backend-full-unit.log), [structured results](final-verification/run-1792594006532/backend-full-unit.results.json)

Follow-up: เปลี่ยน scaffold เป็น meaningful tests หรือแก้ wiring/import ให้ตรง code ปัจจุบันโดยยังแสดง baseline failures จนแก้จริง ไม่ลบ/skip tests เพื่อผ่าน gate

## BUG-FV-BACKEND-DEFAULT-E2E

**OPEN / P1 test infrastructure — F16**

รัน standard `test:e2e` config กับ `test/app.e2e-spec.ts` บน DB fixture ใหม่ พบ module resolver ไม่รู้ `src/prisma/prisma.service` จึง fail **ก่อน assertion (0 tests)** Curated ID/security/workflow/payment/inventory/final configs ที่ใช้จริงมี mapper และรันผ่านตามผลแยก ไม่ได้แปลว่า default E2E entrypoint ผ่าน

หลักฐาน: [command/log](final-verification/run-1792594006532/backend-default-e2e.log), [JSON](final-verification/run-1792594006532/backend-default-e2e.results.json)

Follow-up: ทำ default integration entrypoint ให้ orchestrate DB/config แยกตาม suite และแก้ template root-route expectation ตาม contract ที่ยังใช้งานจริง ไม่แก้ expected root response เองเพื่อกลบ failure ในรอบนี้

## BUG-FV-ID-MIGRATIONS

**RESOLVED / test harness regression — F05/F16**

Initial legacy migration harness skip เฉพาะ display-number migration แต่ลง payment/F14 migrations ที่ใหม่กว่า ทำให้ legacy fixture สอง ACTIVE sessions โต๊ะเดียวชน unique constraint ก่อนถึง backfill test

แก้เฉพาะ harness: reconstruct migrations ที่เก่ากว่า target จริง และแยก legacy sessions อยู่คนละ fixture table เพื่อทดสอบ display-number backfill โดยไม่ปน duplicate-session policy; dedicated payment duplicate-preflight test ยังคงทดสอบการปฏิเสธ conflict แยกและผ่าน

Initial FAIL ถูกเก็บไว้ [initial](final-verification/run-1792594006532/id-migrations.log); [retest PASS](final-verification/run-1792594006532/id-migrations-retest.log) ยืนยัน empty/populated, PK/FK/rows, sequences, uniqueness, repeat no-op และ schema diff exit0 ไม่มีแก้ข้อมูลจริง

Payment historical-schema harness ใช้ cutoff เดียวกันแทนลง migration อนาคตก่อน target แล้ว [retest](final-verification/run-1792594006532/payment-migrations-retest.log) ยังผ่าน data-preservation และ duplicate preflight/rollback

## BUG-FV-COMPOSE-RUNTIME

**RESOLVED / test environment isolation regression — F16**

Initial Compose migrate ล้ม P1001 เพราะ shell `DATABASE_URL` ที่ final runner ส่งต่อมี priority เหนือ `--env-file` ทำให้ container ใช้ `127.0.0.1:55432` ไม่ใช่ `postgres:5432` ของ project ใหม่ เป็น verifier propagation bug ไม่ใช่ DB/production migration failure

แก้เฉพาะ `verify-compose.cjs`: บังคับ environment ที่สร้างสำหรับ test ให้ overwrite inherited values รวม customer key และระบุ Compose file ชัดเจน ไม่เปลี่ยน app/Compose business logic

หลักฐาน [initial](final-verification/run-1792594006532/compose-runtime.log), [diagnostics](final-verification/run-1792594006532/compose-runtime/compose-diagnostics.log), [retest PASS](final-verification/run-1792594006532/compose-runtime-retest.log), [all healthy](final-verification/run-1792594006532/compose-runtime-retest/compose-status.log) ขณะ retest parent ยังมี shell DATABASE_URL ของ test admin จึงพิสูจน์ isolation ที่แก้จริง

## BUG-FV-PAYMENT-POLICY

**BLOCKED / P0 production release blocker — F03, F10, F11, F12**

Authoritative pricing basis, discounts/tax/service/rounding, split/final settlement, expired checkout, confirmation audit และ payment QR/provider ยังไม่มี approved expected จึงยังไม่มี successful checkout → verified payment → new invoice → release table

HTTP checkout หลัง served ตอบ `503 CHECKOUT_POLICY_PENDING`, invoice count ไม่เพิ่ม, session ACTIVE/table OCCUPIED; readiness flags checkout/QR/confirmation=false Safe-deny ของ legacy client-controlled totals ผ่าน แต่ **ไม่ใช่** acceptance ว่าระบบคิดเงินหรือรับชำระได้แล้ว

[Facts](final-verification/run-1792594006532/journey-retest/journey-facts.json), [payment integration](final-verification/run-1792594006532/payment.log), [decision prerequisites](F03_F10_F11_F12_PAYMENT_DECISIONS_TH.md)

Follow-up: อนุมัติ policy/fixtures ก่อนทำ quote, snapshot, payment attempt/confirmation state, idempotent invoice/settlement transaction, receipt และ cleanup/reopen flows ด้วย provider sandbox หรือ manual evidence rule ที่อนุมัติเท่านั้น ไม่ใช้เงินจริง

## BUG-FV-STOCK-POLICY

**BLOCKED / P2 — F14**

Manual adjustment ledger/reconciliation/concurrency ผ่าน แต่ transition ที่ตัด stock, เงื่อนไข void คืน stock, verified legacy recipe units/conversions ยังไม่อนุมัติ จึงยังไม่เปิด automatic deduct/restore ไม่สรุปว่า void คืน stock ตาม rule ผ่าน

หลักฐาน [inventory tests](final-verification/run-1792594006532/inventory.log), [recipe architecture/policy status](F14_INVENTORY_IMPLEMENTATION_TH.md)

Follow-up: อนุมัติ timing/eligibility/snapshot/unit rules แล้วทำ deduction/return ใน transaction เดียวกับ workflow พร้อม unique business references และ duplicate/retry tests

## BUG-FV-PROD-POLICY

**BLOCKED / P0 production access gate — F01/F02/F07**

Default-deny และ OWNER/MANAGER/STAFF/KITCHEN ภายใต้ **test grants/assignments** ผ่าน รวม anonymous, cross-session, expired/inactive identities และ sensitive socket delivery แต่ไม่ได้เปิดอ่าน production config หรือถือว่า permission matrix/assignment ของ deployment ได้อนุมัติแล้ว

[Security tests](final-verification/run-1792594006532/security.log), [policy matrix ที่รอ review](SECURITY_PERMISSION_MATRIX_TH.md)

นี่เป็น gate เรื่อง policy/provisioning ของ production ไม่ใช่ข้ออ้างว่าพบ exploitable bypass ใหม่จาก tests เหล่านี้ Follow-up ต้อง review grants/assignments และทดสอบ environment เป้าหมายที่อนุมัติก่อน public access

## ENV-FV-BROWSER-MOBILE

**NOT RUN / P1 verification gap — F08/F15/F16 และ F12 provider**

Tool discovery ไม่พบ browser-control runtime ไม่มี physical handset หรือ approved banking/provider sandbox ใน environment นี้ จึงไม่ทำ browser UI reload/logout/cookie/E2E หรือ mobile scan/bank confirmation Node client-module contracts และ LAN-interface HTTP/socket smoke จากเครื่อง server ไม่ทดแทนกรณีเหล่านี้

[Fresh LAN smoke](final-verification/run-1792594006532/fresh-runtime.log) ผ่านเฉพาะ HTTP/QR exchange/scoped customer room บน LAN interface จากเครื่อง server ไม่ได้ส่งเงินจริงหรือข้อมูลลูกค้าไปยังผู้ให้บริการ

Follow-up: ทดสอบ browser/phone จริงบน test network, HTTPS cookie/CORS, actual UI reconnect/expiry/stale rendering, แล้วใช้เฉพาะ provider sandbox เมื่อ contract/fixture อนุมัติ
