# Payment-critical audit และ safety foundation — F03/F10/F11/F12

วันที่ 21 ตุลาคม 2026; ตรวจจาก commit `e54456b` และ working tree ปัจจุบัน เริ่มโดยไม่มี local changes

**สถานะ: ยังไม่พร้อมใช้งานรับชำระเงินจริง และห้าม deploy** ข้อกำหนดราคา/settlement/payment confirmation ยังไม่อนุมัติ งานนี้ทำส่วนป้องกันที่ไม่ต้องเดากติกา พร้อม proposal/tests ที่แยกออกจาก runtime ไม่อ้างว่าทุก acceptance ผ่าน

## Business decisions ที่ต้องตอบก่อนทำส่วนการเงินต่อ

เริ่มงานด้วยการขอคำตอบแล้ว แต่ยังไม่ได้รับคำตอบ/การอนุมัติในรอบนี้ รายละเอียดและข้อเสนออยู่ใน [PAYMENT_DECISIONS_TH.md](F03_F10_F11_F12_PAYMENT_DECISIONS_TH.md)

| เรื่อง | คำตอบที่ยังต้องอนุมัติ |
|---|---|
| ราคา | ใช้ snapshot ตอนเปิดหรือราคาเมื่อจ่าย; เปลี่ยน tier ได้หรือไม่ |
| ผู้ใหญ่/เด็ก | เกณฑ์เด็ก/ฟรี, จำนวนคน, ใครแก้ได้และแก้ถึงเมื่อใด |
| ส่วนลด | บาท/เปอร์เซ็นต์, เพดาน, สิทธิ์, ลำดับก่อน/หลังภาษี |
| VAT/service/rounding | inclusive/exclusive, อัตรา/ลำดับคำนวณ, ปัดเมื่อใดและใช้ rounding mode ใด |
| แยกบิล | invoice เดียวหรือ split/partial payment และนิยามยอดค้าง |
| Overdue settlement | ต่อเวลา/ค่าปรับ, ordering timeout, unpaid/settled, เข้า CLEANING/AVAILABLE หลังเหตุการณ์ใด |
| ยืนยันรับเงินจริง | manual/webhook, ผู้ยืนยัน, หลักฐาน, verification, anti-replay และ reversal |
| PromptPay QR | บุคคล/merchant/bill payment, provider/spec/version และ recipient/amount fixtures |

ไม่มีการอนุมาน VAT หรือ role จากชื่อ OWNER/MANAGER และไม่มีการอนุมานว่า Invoice exists/CLOSED/สร้าง QR เท่ากับ PAID

## ผลตรวจโค้ดก่อนแก้

อ่าน invoices service/controller/DTO, sessions/cron, tiers, order models/service, settings, frontend invoice/print/QR, schema/relations/index และ migrations ทุกชุด พร้อม Next.js docs ใน node_modules

| Finding | ยืนยันจากโค้ด | สถานะหลังงานนี้ |
|---|---|---|
| F03 | ใช้ dto.totalAmount, ลบ discount ด้วย JS number, ไม่มี snapshot/authoritative quote | ปิดช่องเขียน legacy checkout ด้วย 503; สูตรเงินจริง **BLOCKED** |
| F10 | อ่าน AVAILABLE/ACTIVE ก่อน transaction; ไม่มี unique active-session/table หรือ invoice semantics/idempotency | แก้ opening concurrency/constraint/idempotency; invoice idempotency **BLOCKED** ตามการตัดสิน split bill/settlement |
| F11 | EXPIRED ยังเข้า CLEANING และ checkout เดิมรับ ACTIVE เท่านั้น; ไม่มี payment state | มี conservative hold ป้องกันเปิดซ้อน แต่ approved overdue checkout/state machine **BLOCKED** |
| F12 | QRCodeSVG รับเพียงเลขโทรศัพท์; settings เก็บใน memory | settings persist และตัด phone-as-payment-QR ออก; standard QR generator/confirmation **BLOCKED** |

## Implementation ที่ทำแล้ว

### ป้องกัน legacy financial writes

- `POST /invoices` ยังผ่าน AuthN/AuthZ ก่อน แต่ request ที่ผ่าน validation/permissions จะได้ **503 CHECKOUT_POLICY_PENDING** ไม่มีการสร้าง invoice, เปลี่ยน session/table หรือ emit invoice:new จาก route นี้
- ไม่รับยอด client มาคิดเงินอีกต่อไป และยังไม่แทนที่ด้วยสูตรที่ไม่ได้อนุมัติ การเปลี่ยน totalAmount จึงไม่สามารถสร้างบิลที่ลดราคาได้ เพราะไม่ออกบิลใหม่ระหว่างรอนโยบาย
- ส่วนลด >0 ต้องมี explicit `invoices.discount` เพิ่มจาก `invoices.write`; role ที่ไม่มี action นี้ได้ 403 ไม่มี role grants ใหม่ใน production แม้มีสิทธิ์ส่วนลดก็ยังได้ 503 ระหว่าง policy pending
- เพิ่ม `GET /invoices/payment-readiness` แบบ read-only ก่อน `:id`: checkoutEnabled/qrEnabled/confirmationEnabled เป็น false ไม่มี guessed amount/quote และไม่มีสวิตช์ env ที่เปิดรับเงินโดยข้ามการอนุมัติ
- GET ใบเสร็จเดิมและยอด aggregate เดิมยังทำงาน ไม่แก้/จัดประเภทการชำระย้อนหลัง ค่า aggregate ยังเป็นผลรวมเอกสารเดิม ไม่ใช่ verified paid ledger

### เปิดโต๊ะ: concurrency และ idempotency

- Lock table row และตรวจ/claim AVAILABLE ภายใน transaction ด้วย conditional update แล้วจึงสร้าง session
- Partial unique index บังคับหนึ่ง ACTIVE session ต่อ table ใน DB ป้องกันแม้มี producer เขียนข้าม service; conflict ตอบ 409 แทน 500
- รองรับ `Idempotency-Key` แบบ optional เพื่อรักษา compatibility ของ client เดิม: 1–128 ASCII ตัวอักษร/ตัวเลข/`._:-`, scope ตาม authenticated actor; advisory transaction lock ต่อ actor/key, canonical request hash และ request row เขียนพร้อม session
- Key เดิม + input เดิมคืน resource เดิม รวม concurrent retry โดยไม่สร้าง session/emit OCCUPIED ซ้ำ; resource ที่คืนเป็นสถานะปัจจุบัน ไม่ได้แกล้งคืนว่า ACTIVE หลังปิดแล้ว
- Key เดิม + input ต่างกันตอบ 409; failure rollback table claim/session/key พร้อมกัน แล้วใช้ key เดิม retry ได้
- ตรวจ guest counts เป็น non-negative Prisma Int และ table/tier ID อยู่ขอบเขต Int; ไม่กำหนดเกณฑ์เด็ก/ราคาหรือโควตาจำนวนลูกค้าเอง

### Hold ระหว่างไม่มี settlement state ที่เชื่อถือได้

**ผลกระทบที่ต้องรับทราบ:** โต๊ะที่มี session เก่าทุกสถานะจะเปิดรอบใหม่ไม่ได้ (409) แม้ Table.status ถูกเปลี่ยนเป็น AVAILABLE หรือมี invoice เก่า เพราะข้อมูลเดิมยังไม่มี proof of settlement การ replay key ของรอบเดิมทำได้ แต่ไม่เปิดรอบใหม่

นี่เป็นข้อจำกัดชั่วคราวเพื่อไม่เปิดซ้อนยอดที่ยังตรวจชำระไม่ได้ ไม่ใช่ state machine สุดท้าย ไม่มี API auto-unlock/auto-settle ให้ข้ามการตรวจรับเงิน

Cron/SessionStatus/TableStatus เดิม **ยังไม่ได้เปลี่ยนกติกา**: EXPIRED ยังอาจแสดง CLEANING; test ระบุพฤติกรรมนี้ไว้ตรง ๆ แต่ open guard ปฏิเสธการใช้โต๊ะซ้ำ ชื่อสถานะบนผังโต๊ะจึงยังไม่ใช้ตัดสินว่าเคลียร์เงินแล้ว การแยก ordering timeout/settlement/cleaning และ checkout หลังหมดเวลาต้องรออนุมัติ

### Settings และ invoice UI

- Persist singleton `PaymentSettings` ใน PostgreSQL เก็บผู้แก้ล่าสุดจาก authenticated user และเวลา ไม่ใช้ instance memory อีกต่อไป ทดสอบด้วย backend Node processes ที่หยุดแล้วเริ่มใหม่จริง
- ตรวจชนิดข้อมูล, trim, ไม่ว่าง, max 64 และไม่ให้ control characters; explicit null ล้างค่า ส่วน `{}` ถูกปฏิเสธ ค่าเก็บนี้ยังเป็น **unverified receiver reference** ไม่ใช่ validation/checksum/ownership ของบัญชี provider
- คง permission `payment-settings.read/write` เดิม ไม่มี grants เพิ่ม และไม่เชื่อ actor ที่ client ระบุ
- Invoice UI เปลี่ยนเป็นอ่านเอกสารเดิม/ตั้งค่าที่เก็บใน DB พร้อมข้อความ pending policy; ปิดการสร้างบิลและลบ QR ที่ encode โทรศัพท์ตรง ๆ ทั้ง dialog และเอกสารพิมพ์ ไม่มีการ render QR แล้วแสดงว่าจ่ายแล้ว
- UI/เอกสารใช้ stored Decimal strings โดยไม่คำนวณจาก tier ปัจจุบัน; แสดงอย่างน้อยสองตำแหน่งและรักษาทศนิยมเดิมที่ยาวกว่าไว้ ไม่ปัดยอดย้อนหลังโดยไม่มีนโยบาย เอกสารพิมพ์ escape ข้อความจากข้อมูลก่อนประกอบ HTML
- Swagger ระบุ checkout 503, readiness และ config ที่ยังไม่ verified; amount ของ invoice response ระบุ string ให้ตรงกับ Decimal JSON ที่ backend ส่งจริง

## Migration/backfill/recovery/rollback plan

เพิ่มเฉพาะ `backend/prisma/migrations/20261021110000_payment_safety_foundation/migration.sql` **ไม่แก้ migration เดิม**

1. ภายใน transaction ตรวจ ACTIVE ซ้ำต่อโต๊ะก่อน; ถ้าพบจะ RAISE และหยุด ไม่เลือก winner/ปิด session/ลบข้อมูลเอง
2. เพิ่ม partial unique index `Session_one_active_per_table`, `SessionOpenRequest` พร้อม composite key actor/key และ FK, และ `PaymentSettings` singleton พร้อม length/control/ID constraints กับ FK ผู้แก้ล่าสุด
3. Backfill settings เป็น NULL เท่านั้น เพราะค่า memory เดิมกู้คืนจาก DB ไม่ได้ ต้องให้ผู้มีสิทธิ์ตรวจและบันทึกใหม่ ไม่เลือกเลขจาก invoice ใบใดมาเป็นบัญชีรับเงินโดยอัตโนมัติ
4. ไม่ backfill idempotency keys/actor ที่ไม่เคยบันทึก และไม่เติม pricing snapshot ด้วยราคาปัจจุบัน ไม่มีการเปลี่ยน financial amounts หรือประทับ PAID ให้ข้อมูลเก่า
5. ไม่เพิ่ม UNIQUE(invoice.sessionId) เพราะยังไม่ทราบว่าอนุญาต split bill หรือไม่ Fixture legacy ที่มีสอง invoices ต่อ session ยังคงอยู่ครบ
6. ใช้ partialIndexes preview ที่รองรับใน Prisma 7.4.2 ที่ติดตั้ง; generate/validate และ diff ของ DB ว่าง/ข้อมูลเดิมผ่าน ไม่มี schema drift ที่เครื่องมือตรวจพบ ต้องคง regression นี้เมื่ออัปเกรด Prisma

ทดสอบ DB ใหม่ 3 ฐานที่ `127.0.0.1:55432` ดู [test-databases.json](payment-evidence/test-databases.json):

- empty: migrate deploy ผ่าน
- populated: migrate จากห้าชุดเดิม, เปรียบเทียบ User/Tier/Table/Session/Invoice ทุก row ก่อน/หลังเท่ากัน รวมหลาย invoice/session และ decimal values
- duplicates: migration ถูกปฏิเสธตาม preflight; rows อยู่ครบและ DDL ใหม่ rollback ไม่ได้ reconcile fixture ให้เอง

**Recovery เมื่อข้อมูลเดิมขัดกัน:** หยุด rollout, ตรวจ duplicate ACTIVE ด้วย read-only query แล้วให้เจ้าของข้อมูลตัดสินแต่ละ session ภายใต้กติกา settlement ที่อนุมัติ หลังแก้โดยผู้ได้รับอนุญาตและตรวจ backup แล้ว จึง `prisma migrate resolve --rolled-back 20261021110000_payment_safety_foundation` และ migrate deploy ใหม่ ห้าม mark applied หาก DDL ไม่สำเร็จ ขั้นตอน reconcile/resolve นี้ **NOT RUN** เพราะ fixture ต้องคงข้อมูลขัดกันไว้และไม่มีอนุมัติแก้ยอด/สถานะย้อนหลัง

Prisma 7.4 รายงาน error เป็น current transaction is aborted บางครั้งหลัง SQL preflight RAISE; test ตรวจ error ต้นทางซ้ำด้วย SQL migration เดียวกันผ่าน pg แล้ว ROLLBACK connection เพื่อยืนยันสาเหตุ ดู [migration log](payment-evidence/migrations.log)

**Rollback ที่รักษาข้อมูล:** rollback application แบบคง financial safe-deny ไว้ อย่าย้อนกลับไปเปิด legacy client-priced checkout เก็บตาราง settings/idempotency/index ไว้ ไม่ drop/reset หรือแก้ migration ที่เคยใช้ ข้อมูลที่เขียนแล้วต้องคงไว้ หากต้องเปลี่ยนข้อจำกัดภายหลังให้เป็น forward migration หลัง reconciliation/approval และตรวจ compatibility ของ clients พร้อมกัน

## ผลทดสอบจริง

| คำสั่ง/ชุดตรวจ | ผล | Exit | หลักฐาน |
|---|---|---|---|
| `npm run prisma:generate` / backend | PASS Prisma 7.4.2 | 0 | [log](payment-evidence/prisma-generate.log) |
| `prisma validate` / backend | PASS | 0 | [log](payment-evidence/prisma-validate.log) |
| `npm run test:payment:migrations` / backend | PASS: empty/populated + expected duplicate rejection, DB/schema diff 0 | 0 โดย suite; duplicate deploy exit 1 ตามคาด | [results](payment-evidence/migration-results.json), [log](payment-evidence/migrations.log) |
| `npm run test:payment` / backend | PASS 8 safeguards unit tests | 0 | [log](payment-evidence/payment-unit.log) |
| `npm run test:payment:e2e` / backend | PASS 19 real HTTP/DB/process restart tests | 0 | [final log](payment-evidence/payment-e2e-final.log) |
| `npm run test:payment:proposal` / backend | PASS 5 **design-only** fixtures ไม่ใช่ approved billing | 0 | [log](payment-evidence/pricing-proposal.log) |
| `npm run test:ids` / backend | PASS 30 | 0 | [log](payment-evidence/id-unit-final.log) |
| `npm run test:security`, `npm run test:workflow` / backend | PASS 8 + 25 | 0 | [security](payment-evidence/security-unit.log), [workflow](payment-evidence/workflow-unit.log) |
| `npm run test:ids:e2e` / backend | PASS 6 | 0 | [log](payment-evidence/id-e2e.log) |
| `npm run test:security:e2e` / backend | PASS 29 | 0 | [log](payment-evidence/security-e2e.log) |
| `npm run test:workflow:e2e` / backend | PASS 21 | 0 | [log](payment-evidence/workflow-e2e.log) |
| `npm run test:payment` / frontend | PASS 3 exact display/receipt/escaping tests | 0 | [log](payment-evidence/frontend-payment.log) |
| frontend security/IDs/workflow tests | PASS 3 + 3 + 4 | 0 | [security](payment-evidence/frontend-security.log), [IDs](payment-evidence/frontend-ids.log), [workflow](payment-evidence/frontend-workflow.log) |
| scoped backend/frontend ESLint | PASS ไม่มี errors/warnings ใน scope สุดท้าย | 0 | [backend](payment-evidence/backend-lint-final.log), [frontend](payment-evidence/frontend-lint.log) |
| frontend `tsc --noEmit` | PASS | 0 | [log](payment-evidence/frontend-types.log) |
| backend `npm run build` | PASS | 0 | [log](payment-evidence/backend-build.log) |
| frontend build พร้อม local API/Socket URLs | PASS หลังให้สิทธิ์ดาวน์โหลด Google Font; รอบ sandbox exit 1 | 0 final | [final](payment-evidence/frontend-build-final.log), [sandbox](payment-evidence/frontend-build.log) |
| `SHABU_SMOKE_SUITE=payment npm run test:local-start` พร้อม isolated DB opt-in | PASS backend/frontend start, Swagger/login/QR render smoke; หยุด child processes | 0 | [log](payment-evidence/local-start.log) |
| `npm test -- --runInBand` / backend | **FAIL** 25 suites / 24 tests; PASS 7 suites / 71 tests | 1 | [log](payment-evidence/backend-full-tests.log) |
| actual backend stop/start persistence | PASS เขียน settings process แรก อ่านค่าเดิม process ที่สอง; readiness ยัง false | อยู่ใน 19 E2E tests | [process log](payment-evidence/restart-process.log) |
| approved pricing/settlement/QR/provider confirmation acceptance | **BLOCKED / NOT RUN** | — | ไม่มี approved policy/provider fixtures |
| browser/mobile/bank QR scan/webhook provider | **NOT RUN** | — | ไม่มีการอ้างว่า render smoke เท่ากับ browser/payment acceptance |

Unit/integration/client tests ใน scope ผ่าน 159 ข้อ และ design proposal อีก 5 ข้อ ไม่บวก full-suite ซ้ำ; ไม่อ้างว่า repository tests ทั้งหมดผ่าน ปัญหา full-suite ยังเป็น scaffold DI และ typo import `kitchens/kitechens.controller.spec.ts` เดิม ไม่ skip/ซ่อน failures

บันทึกคำสั่ง/exit status รวมอยู่ใน [command-results.json](payment-evidence/command-results.json) และ [integration-build-results.json](payment-evidence/integration-build-results.json)

Regression integration ใช้ payment test DB ที่ migrate แล้ว โดยเพิ่ม allowlist ของชื่อ DB ทดสอบแบบเฉพาะเจาะจงใน guards ของ test files เท่านั้น ไม่แก้ schema ของ DB ทดสอบชุดก่อน ไม่ได้แตะ DB จริง

การรัน payment integration แรกพบ 3 FAIL / 16 PASS จาก PostgreSQL advisory function คืน void ซึ่ง Prisma deserialize ไม่ได้ แก้ SQL projection เป็น integer แล้ว final 19 PASS เก็บ [initial failure](payment-evidence/payment-e2e-initial.log) ไว้ ส่วน migration test แรก assert ข้อความจาก Prisma โดยตรงไม่ได้เพราะ error wrapping จึงแยกตรวจ SQL ต้นทาง เก็บ [initial log](payment-evidence/migrations-initial.log) และ DB เดิมไว้

## Acceptance ที่ยังไม่ควรถูกตีความว่าผ่าน

| Acceptance | สิ่งที่พิสูจน์ได้ | สิ่งที่ยัง BLOCKED |
|---|---|---|
| เปลี่ยน totalAmount ไม่ลด bill; discount ไม่เกินยอด | safe-deny ไม่มี financial writes และ permission ส่วนลดทำงาน; design fixtures ตรวจ bound | successful authoritative quote/invoice และเพดานส่วนลดจริง |
| ทศนิยม API/UI/receipt ตรง fixtures | stored legacy Decimal และ synthetic exact fixtures ตรงกัน ไม่ reprice ตาม tier ใหม่ | expected receipt ของ policy ที่อนุมัติ |
| concurrency / duplicate invoice retry | opening มีหนึ่ง session, idempotent retry และ rollback จริง | invoice duplicate/retry semantics ภายใต้ single/split billing; ตอนนี้ invoice POST ถูกปิดทั้งหมด |
| expired unpaid สั่งไม่ได้แต่ checkout ได้ | ordering ถูกปฏิเสธและเปิดซ้อนถูก hold แม้ manual AVAILABLE/CLOSED หรือมี invoice เดิม | successful overdue checkout และ approved cleaning/settlement machine |
| QR decode recipient/amount และ settings อยู่หลัง restart | DB settings/restart PASS; phone-as-QR ถูกถอดออก | QR generator/decoder กับ provider fixtures ที่อนุมัติ |
| PAID เมื่อ confirmation ตาม policy | ไม่มีเส้นทางสร้าง PAID/ถือว่ามีเงินเข้าจาก QR rendering | PaymentStatus/verified confirmation policy, implementation และ audit/provider integration |

## ไฟล์และ compatibility

ดู [code diff](payment-evidence/code-changes.patch) และ [รายการไฟล์](payment-evidence/changed-code-files.json)

- invoices service/controller/DTO + payment-readiness: ปิด unsafe writes, แยก discount action, readiness และ Decimal response docs
- sessions service/controller/DTO: atomic claim, actor-scoped idempotency, conservative settlement hold, input bounds; รวม CreateSessionDto ที่เคยซ้ำให้ใช้ตัวเดียว และเติม await events หลัง commit
- schema + migration ใหม่: partial unique ACTIVE/table, idempotency persistence, settings persistence; ไม่แตะ invoices เดิม
- settings service/controller/DTO/receiver-reference: DB config, server updater และ syntax validation ที่ไม่แกล้งว่า provider verified
- frontend invoices/page + payment-display + Invoice types: เปลี่ยนเป็นอ่านเอกสารเดิม/ตั้งค่า, ไม่สร้างบิลหรือ raw phone QR, exact decimal rendering/receipt
- payment unit/E2E/design fixtures, migration verifier, scripts และ local-start test allowlist; regression test DB guards รองรับเฉพาะ payment_empty timestamp เพิ่มเติม

**Breaking behavior ที่ตั้งใจ:** POST /invoices ได้ 503 แทน 201, ส่วนลดไม่มี action ได้ 403, เปิดโต๊ะที่มีประวัติ session ได้ 409 ระหว่าง hold, ปุ่มสร้างบิล/QR เดิมไม่ทำงาน และ settings ต้องส่ง field อย่างชัดเจน (null เพื่อล้างค่า) ต้องแจ้งและรีวิวก่อน rollout ใด ๆ

ID contract และ QR สั่งอาหารยังใช้รูปแบบเดิม; opening Idempotency-Key เป็น optional; invoice read JSON เป็น Decimal strings เหมือนเดิมแต่ types/docs แก้ให้ตรง; payment settings path/response field เดิมคงอยู่ ค่า process memory เดิมไม่สามารถ backfill อัตโนมัติ

## Risks / งานถัดไปหลังอนุมัติ

1. hold นี้ทำให้โต๊ะเดิมไม่พร้อมเปิดรอบใหม่จนมี approved settlement/reconciliation flow จึงเป็น **deployment blocker** ที่ต้องอ่านคู่กับการปิด checkout ไม่ใช่ระบบชำระสำเร็จรูป
2. EXPIRED/CLEANING/AVAILABLE เดิมบน UI ยังไม่ใช่ settlement truth ต้องแก้ state machine หลังอนุมัติ ห้ามแก้ข้อมูลเพื่อหลบ hold โดยลบประวัติ
3. Invoice idempotency/constraints ยังไม่ลง runtime เพราะ split bill ไม่ทราบ; ต้องทำพร้อม quote/version/outstanding balance/payment attempts ไม่เพิ่ม unique sessionId โดยพลการ
4. ไม่มี pricing snapshot/payment status ย้อนหลังที่พิสูจน์ได้ ต้องกำหนด reconciliation และ backfill strategy เป็น UNKNOWN/REVIEW_REQUIRED แทนเดาราคา/PAID
5. Config validation ยังไม่รับรองเลขบัญชี/PromptPay หรือ account ownership; ก่อนเปิด QR ต้องมี profile/provider checks, verified recipient, amount/currency fixtures, CRC/TLV/provider reference tests ตาม spec ที่เลือก
6. ยังไม่มี payment confirmation/revenue ledger ที่ verified; historical aggregate ไม่ใช่หลักฐานเงินเข้า และ document print ถูกระบุเป็นเอกสารเดิม
7. Idempotency records ไม่มี automatic expiry เพราะยังไม่อนุมัติ retention/retry window; ต้องรักษา request history ระหว่าง rollout/rollback
8. Partial indexes เป็น Prisma preview ต้องตรวจ generated client/migrations/introspection เมื่อ upgrade และต้อง preflight legacy duplicate sessions ก่อน migration deployment

## แหล่งอ้างอิงสำหรับ design

[Thai QR Payment Standard — ธปท.](https://www.bot.or.th/content/dam/bot/documents/th/our-roles/payment-systems/about-payment-systems/ThaiQRCode_Payment_Standard.pdf) ใช้ระบุว่าต้องเลือก payment profile/โครงสร้างข้อมูลที่ถูกต้องก่อนสร้าง generator ไม่ใช่เลือกจากการ encode โทรศัพท์เพียงอย่างเดียว

[Prisma v7 transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions) และ [partialIndexes ใน Prisma 7.4](https://www.prisma.io/changelog/2026-02-11) ใช้ประกอบ transaction/idempotency และ schema migration implementation ที่ทดสอบกับเวอร์ชันติดตั้งจริง

ไม่ได้ deploy/merge/push ไม่แตะฐานข้อมูลจริง ไม่ drop/truncate/reset DB และไม่แก้ migration เดิม Cleanup เฉพาะ trigger/function ที่ test สร้างเพื่อบังคับ failure แล้วเก็บฐานข้อมูล/fixtures ไว้
