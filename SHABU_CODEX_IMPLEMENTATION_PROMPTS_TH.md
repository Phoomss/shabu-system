# Shabu System — ชุด Prompt สำหรับสั่ง Codex ตรวจสอบและปรับปรุงระบบ

> เอกสารสำหรับใช้คู่กับ `SYSTEM_AUDIT_FOR_GPT_TH.md` และ Repository จริง  
> ฐานอ้างอิง: Static audit วันที่ 21 ต.ค. 2026, commit `f18cb42`  
> สถานะ: เป็นข้อค้นพบจากรายงาน ไม่ใช่การยืนยันจากโค้ดล่าสุดหรือ E2E ที่ผ่านแล้ว

## วิธีใช้งาน

1. เปิด Codex ที่ root ของ Repository Shabu System และให้เข้าถึงไฟล์รายงาน `SYSTEM_AUDIT_FOR_GPT_TH.md` (วางไว้ใน Repository หรือส่งเนื้อหาให้ Codex)
2. ส่ง **Prompt 0** ก่อนเพื่อยืนยันหลักฐาน/สร้าง baseline โดยไม่แก้ production logic
3. ส่งงาน **01–07 ทีละ Prompt**; ตรวจ diff, tests และข้อสมมติ ก่อนอนุมัติงานต่อไป
4. งานที่เกี่ยวกับ business decisions หากไม่มีข้อกำหนด ให้ Codex ออกแบบทางเลือก/เสนอ default ที่ปลอดภัย พร้อมหยุดเฉพาะการเปลี่ยนแปลงที่ต้องอาศัยคำตัดสิน ไม่ต้องหยุดการ audit หรือการเพิ่ม test
5. อย่าสั่ง deploy, merge, delete branch หรือเปลี่ยน production DB ผ่าน Prompt เหล่านี้

## การจัดลำดับความเสี่ยง

- **P0:** F01 — server-side RBAC; F02 — anonymous public orders/QR authorization; F03 — server-authoritative invoice total; F07 — Socket room/event authorization
- **P1:** F04 — ID contract; F05 — migrations; F06 — tier/time validation; F08 — QR socket stale state; F09 — routes; F10 — concurrency/idempotency; F11 — expired checkout; F12 — payment QR/settings; F13 — order transitions; F16 — build/deploy/CI
- **P2:** F14 — inventory/ledger; F15 — frontend auth state

**ข้อควรระวัง:** 293 TypeScript errors ในรายงานมาจากสภาพแวดล้อมที่ dependencies ไม่ครบ จึงไม่ใช่การนับ bugs 293 จุด ต้องติดตั้งตาม lockfile แล้วตรวจใหม่ก่อน

---

## Prompt 0 — Verify Audit & Build Baseline (READ-ONLY ก่อน)

```text
คุณคือ Senior Software Architect + Senior Full-Stack Engineer ทำงานใน Repository Shabu System ปัจจุบัน

บริบท: frontend Next.js/React/TypeScript, backend NestJS, Prisma/PostgreSQL, Socket.IO, Docker Compose, GitHub Actions. มีรายงาน SYSTEM_AUDIT_FOR_GPT_TH.md ซึ่งอิง commit f18cb42 (21 ต.ค. 2026) และเป็น static audit เท่านั้น

ภารกิจรอบนี้ = ตรวจสอบหลักฐาน ไม่แก้ business logic
1. อ่าน README, package.json และ lockfile ทั้งสองแอป, Prisma schema/migrations, app.module, auth, sessions, orders, invoices, gateway, frontend QR, Docker/CI, และรายงาน Audit
2. ตรวจ current commit/branch/working tree ก่อนทำอะไร ห้ามทับ local edits; เทียบข้อค้นพบ F01–F16 กับโค้ดปัจจุบัน ให้สถานะ Confirmed / Changed / Needs runtime verification / Not reproducible พร้อม path:line ที่ตรวจจริง
3. ตรวจ Node/package manager ตาม lockfile/.nvmrc/CI และระบุความต่างจาก environment; ติดตั้ง dependency ได้เฉพาะ local development โดยไม่อัปเกรดแพ็กเกจ/แก้ lockfile เองถ้าไม่จำเป็น
4. รัน generate/build/lint/test แบบไม่ใช้ --fix; หากต้องใช้ DB ให้ใช้ local/test DB เท่านั้น และแจ้งก่อนคำสั่งที่กระทบ schema/data; แยก environment failure จาก source failure
5. ทำ dependency graph, API/Socket event contract, ID formats, workflow diagram ตั้งแต่ staff เปิดโต๊ะ → QR → order → KDS → invoice → payment confirmation → cleaning
6. จัดลำดับแก้ที่ลดความเสี่ยง โดยรักษา compatibility; ชี้จุดที่ต้องตัดสินใจด้าน business

ข้อห้าม: ห้าม deploy, push, merge, delete branches, ใช้ production DB, เปิดเผย secrets, ลบข้อมูลเพื่อให้ test ผ่าน, rewrite ทั้งระบบ หรือสรุปว่ารันทดสอบผ่านถ้าไม่ได้รัน

ส่งผลเป็นภาษาไทยในรายงาน Markdown: ตาราง Issue ID/หลักฐานปัจจุบัน/severity/dependencies/แนวทางแก้; ผลคำสั่ง exit code; ข้อจำกัด; รายการคำถาม; ลำดับงานต่อไป โดยยังไม่ลงมือแก้ production logic
```

## Prompt 01 — Build Baseline, ID Contract & Migrations (F04, F05, F16 บางส่วน)

```text
แก้เฉพาะ F04/F05 และ F16 ส่วนที่จำเป็นต่อ local build/start โดยอ้างรายงาน SYSTEM_AUDIT_FOR_GPT_TH.md และตรวจยืนยันโค้ดล่าสุดก่อนทุกการแก้

อ่านก่อน: backend/src/sessions/**, backend/src/orders/**, backend/prisma/schema.prisma, backend/prisma/migrations/**, backend/prisma.config.ts, backend package.json/tsconfig, frontend/src/app/order/[token]/page.tsx, Dockerfile/compose และจุด emit/consume Socket ID

เป้าหมาย:
- กำหนด ID contract เดียวสำหรับ REST/Socket/Frontend; raw DB IDs ใช้ภายใน backend และ boundary ต้อง encode/decode/validate ให้ตรงกัน; display numbers ต้องไม่ถูกใช้แทน PK
- แก้ session/table/order identifier ที่ส่งจาก frontend กลับ backend แล้วหาไม่เจอ และการปิด session ที่ส่ง formatted table ID ไปหา Prisma Int
- เพิ่ม migration ที่ขาดสำหรับ User.userNumber, Session.sessionNumber, Order.orderNumber, Invoice.invoiceNumber พร้อม backfill ของข้อมูลเดิม, uniqueness/sequence ตาม schema และ rollback/recovery strategy
- ทำให้ติดตั้ง dependencies → Prisma generate → migrate test DB → backend/frontend build/start ได้บน local/test environment

ข้อกำหนด: ไม่ rewrite API โดยพลการ; ถ้าจำเป็นต้องเปลี่ยน contract ให้ระบุ compatibility/แผน transition และปรับ producers/consumers พร้อมกัน; อย่าแก้ migration เดิมที่เคยรันแล้ว; ห้าม drop/truncate/reset DB ที่มีข้อมูล; ไม่แก้ Docker/CI ส่วนอื่นที่ไม่เกี่ยวกับ build baseline

Acceptance (Given/When/Then):
1. Given session ID ที่ API ส่งจริง When ลูกค้า QR สั่ง/อ่านประวัติ Then backend resolve session เดียวกัน
2. Given malformed/nonexistent ID When เรียก endpoint Then ได้ 400/404 ตาม contract ไม่ใช่ 500
3. Given session เปิดอยู่ When ปิด/หมดเวลาผ่าน cron Then table state อัปเดตสอดคล้องและ operation ไม่สำเร็จครึ่งเดียว
4. Given empty test DB หรือ test DB ที่มีข้อมูลจำลอง When migration deploy Then schema ตรงและไม่สูญข้อมูล
5. Given clean install When build/start Then บันทึกผลคำสั่งจริงพร้อม exit status

เพิ่ม unit/integration regression tests ที่เหมาะสม รายงานไฟล์ที่แก้/เหตุผล/migrations/ผล tests (PASS/FAIL/NOT RUN)/risks และ diff summary เป็นภาษาไทย ห้าม deploy/merge/push
```

## Prompt 02 — Server Authorization, Customer QR Credential & Socket Security (F01, F02, F07)

```text
คุณคือ Security-focused NestJS Engineer ตรวจและแก้ F01/F02/F07 ใน repository ปัจจุบัน โดยใช้ SYSTEM_AUDIT_FOR_GPT_TH.md เป็นสมมติฐานตั้งต้นและตรวจโค้ดจริงก่อน

อ่านก่อน: role/user/auth/guards/decorators/controllers, orders controller/service/DTO, sessions/QR token flow, events.gateway.ts, app bootstrap CORS, frontend staff/QR Socket consumers และ Swagger

เป้าหมาย:
1. สร้าง permission matrix ระดับ endpoint/action/role (OWNER, MANAGER, STAFF, KITCHEN และ role จริงในโค้ด) ให้รีวิวก่อนบังคับใช้ rule ที่ยังไม่มีคำตอบทางธุรกิจ
2. บังคับ AuthN/AuthZ ฝั่ง server สำหรับ employee APIs (401 เมื่อไม่ login, 403 เมื่อไม่มีสิทธิ์) รวมจัดการ role/user, void, payment settings; อย่าถือว่าซ่อน UI แล้วปลอดภัย
3. ออกแบบ customer-specific credential จาก QR ที่ผูก session, ตรวจลายเซ็น/อายุ/สถานะ, scope ต่อโต๊ะ; ไม่ใช้ sessionId เป็น credential; แยก staff order listing กับ customer endpoints พร้อมป้องกัน cross-session leakage
4. ตรวจ JWT หรือ QR credential ก่อน Socket join/rejoin kitchen/session room; จำกัด server broadcast invoice/stock ให้เฉพาะผู้เกี่ยวข้องและทบทวน allowed CORS origins ตาม config
5. จำกัดข้อมูล response และป้องกัน exposure ของ user/financial fields ที่ customer ไม่จำเป็นต้องเห็น

เงื่อนไข: ถ้า permission matrix ยังไม่ได้อนุมัติ ห้ามแต่งกติกา OWNER/MANAGER/STAFF ขึ้นเอง ให้แสดงตารางที่ต้องตัดสินใจและ implement เฉพาะ safe-deny ที่ยืนยันได้; ต้องมีทางใช้งาน QR โดยไม่บังคับ staff login แก่ลูกค้า; ตรวจ backward compatibility ของ QR ที่เคยออกแล้ว

Acceptance:
- anonymous staff endpoint ได้ 401, user role ผิดได้ 403
- ไม่มี QR credential อ่าน orders ทุกโต๊ะหรือ POST คำสั่งของโต๊ะใดไม่ได้
- QR credential ของโต๊ะ A ใช้กับโต๊ะ B, closed/expired session ไม่ได้
- Socket anonymous, cross-session, wrong-kitchen join ถูกปฏิเสธ; reconnect ต้อง auth ใหม่
- customer socket ไม่ได้รับ invoice:new และ ingredient:low_stock ของพนักงาน
- เพิ่ม REST/Socket auth integration tests ทั้ง positive/negative และอัปเดต Swagger/API clients

รายงาน security decisions, endpoint matrix, code diff และ test results ตามที่รันจริง ห้าม deploy/merge/push
```

## Prompt 03 — QR Ordering, Tier Rules, KDS & Order State Machine (F06, F08, F09, F13)

```text
ตรวจและปรับ workflow QR → Order → KDS → Status ตาม F06/F08/F09/F13 จากรายงาน ก่อนแก้ให้ยืนยันว่าชั้น ID contract (F04) และ customer authorization (F02/F07) พร้อมหรือไม่ หากยังไม่พร้อม ให้ทำ tests/plan ก่อนและระบุ blocker

อ่านก่อน: OrdersService/DTO/controller, SessionService, TierMenuItem, MenuItem, events.gateway, frontend order/[token]/page.tsx, menus/page.tsx, KDS component/API client และ status/void enums

เป้าหมาย:
- backend validate tier membership, active session, server endTime, menu availability, array min size, quantity limits, ownership; UI แสดงเฉพาะเมนูที่สั่งได้ตามแพ็กเกจ
- แก้ frontend join session room หลัง resolve credential/session, rejoin เมื่อ reconnect, state closure/stale fetch, stable listener cleanup, และสื่อสาร session expired/closed ทันที
- แก้ endpoint /kitchen-sections vs /kitchens ตาม contract และยืนยัน route /orders/void-logs ไม่ถูก :id ดัก
- สร้าง allowed order/item status transitions โดยชัดเจน; ทุก VOIDED ผ่าน void flow พร้อม audit actor/reason; response และ Socket event ต้องสะท้อน state หลัง commit จริง ไม่ emit event ของ item ที่ไม่ได้เปลี่ยน

Acceptance:
- นอก tier, หมดเวลา, ไม่พร้อมขาย, items ว่าง หรือ qty ไม่ถูกต้อง → request ถูกปฏิเสธแม้เรียก API ตรง
- QR สั่ง → KDS เห็น → ครัวอัปเดต → ลูกค้าเห็นสถานะโดยไม่ refresh; reconnect sync สถานะใหม่
- GET /orders/void-logs เข้า handler ถูกและ kitchen dropdown โหลดได้
- void ทุกครั้งเกิด VoidLog และ invalid state transition ถูกปฏิเสธ
- API/database/Socket สถานะหลัง transaction ตรงกัน

เพิ่ม test ที่ตรวจ auth+validation+state transitions และ report PASS/FAIL/NOT RUN ตามจริง ห้ามแต่งกติกา auto-void/auto-refund เอง
```

## Prompt 04 — Trusted Pricing, Checkout, Payment QR & Concurrency (F03, F10, F11, F12)

```text
ตรวจและแก้ F03/F10/F11/F12 ตามรายงาน โดยถือว่าเป็น payment-critical changes ห้าม deploy จนมีข้อกำหนดราคา/การชำระเงินอนุมัติ

อ่านก่อน: invoices.service/controller/DTO, sessions state/cron, tiers/pricing, orders totals, settings/payment, frontend invoices/page.tsx, DB relations/index/migrations และ payment QR implementation

เริ่มด้วยรายการ business decisions ที่ต้องได้คำตอบ: ราคาตอนเปิดโต๊ะหรือชำระ, เด็ก/ผู้ใหญ่, ส่วนลดและสิทธิ์, VAT/service charge/rounding, แยกบิลหรือไม่, overdue settlement, manual payment confirmation หรือ webhook, ประเภท PromptPay QR และเกณฑ์ยืนยันรับเงินจริง; หากไม่รู้ ให้แยก design proposal/test จาก implementation ที่ผูกกับคำตอบ

เป้าหมายทางเทคนิค:
- backend เป็นผู้กำหนดยอดตาม pricing snapshot/business rule ที่ตกลง; ใช้ Prisma Decimal หรือ integer satang; client totalAmount เป็น display only/validation ไม่ใช่ source of truth
- discount ไม่เกินยอด, คำนวณ net amount ไม่ติดลบ และตรวจ role สำหรับการให้ส่วนลด
- ป้องกัน session/invoice ซ้ำภายใต้ concurrent requests ด้วย atomic conditional update, DB constraints และ idempotency keys รวม retry/failure rollback
- session หมดเวลาหยุดสั่ง แต่ยังชำระยอดค้างได้; แยก ordering-timeout ออกจาก checkout/table-cleaning state ตาม state machine ที่อนุมัติ
- สร้าง payload QR payment ตามมาตรฐาน/ผู้ให้บริการที่ยืนยัน มีจำนวนเงิน/ผู้รับตามข้อกำหนด; persist payment settings ใน DB พร้อม validation/access control; QR generation ไม่ใช่ payment confirmation

Acceptance:
- แก้ request totalAmount ไม่ลด bill; discount เกินยอดถูกปฏิเสธ
- ทศนิยมและยอดตรงกัน API/UI/receipt ตาม expected fixtures
- 2 concurrent requests เปิดโต๊ะเดียวกันได้หนึ่ง session ตามกติกา; duplicate invoice/retry ไม่ทำให้บันทึกซ้ำ
- expired-but-unpaid session สั่งไม่ได้แต่ checkout ได้ และโต๊ะไม่ถูกเปิดซ้อนยอดค้าง
- payment QR decode ได้ข้อมูลผู้รับ/ยอดตาม fixtures; restart backend แล้ว settings ไม่หาย
- สถานะ PAID เปลี่ยนเมื่อเกิด confirmation ตาม policy เท่านั้น ไม่ใช่ตอน render QR

ใช้ local/test DB เท่านั้น; มี migration/backfill/rollback plan; สรุป tests ที่รันจริง, unresolved business decisions และ compatibility
```

## Prompt 05 — Inventory Ledger & Concurrency (F14)

```text
ปรับ Inventory เฉพาะ F14 หลังยืนยัน order/void transition semantics จากงาน 03 และ business rule เรื่องจุดตัด/คืน stock

อ่าน: IngredientsService.adjustStock, Recipe/Ingredient Prisma models, OrdersService, void flow, ingredient:low_stock broadcasts และ inventory UI

ออกแบบและ Implement ภายใต้กติกาที่อนุมัติ:
- stock movement ledger: idempotent reference ต่อ business event, type/reason, units/quantity, timestamps/actor
- deduct/restore ตาม recipe เมื่อ transition ที่ตกลง; ป้องกัน double-deduct/double-return เมื่อ retry หรือ duplicate event
- atomic adjustments / optimistic locking หรือ row lock ตาม DB โดยมี tests parallel requests; ไม่ให้ lost updates
- reorder threshold เป็น field/ค่าคงที่ที่บันทึกจริง ไม่ใช่เอาคงเหลือก่อนหน้ามาเทียบ
- ตรวจหน่วย recipe และ conversion, insufficient stock และ policy ไม่ให้ค่าติดลบถ้า business rule ต้องห้าม

Acceptance: retry ไม่ตัดซ้ำ; void คืนครั้งเดียวตาม rule; concurrent adjustments ได้ผลถูกต้อง; ledger reconciliation ตรง balance; low stock แจ้งที่ threshold จริง

ห้าม reset stock จริง/เพิ่ม logic คืน stock เองเมื่อไม่มีการอนุมัติ; ถ้า requirement ไม่ชัดให้ทำ architecture + tests ที่ไม่ผูก policy และสรุปทางเลือกก่อนแก้จุดนั้น
```

## Prompt 06 — Auth Lifecycle, Docker & CI Hardening (F15, F16)

```text
ตรวจ F15/F16 โดยยืนยันโค้ดล่าสุดและรักษา security fixes จากงาน 02

อ่าน: frontend/src/stores/authStore.ts, api.ts, middleware.ts, auth layout, Next.js config, Dockerfiles, docker-compose, Nest main.ts, prisma.config.ts, package/lockfiles, tsconfig, workflows, docs

เป้าหมาย:
- frontend auth state แหล่งเดียวตาม Zustand storage contract; refresh token request deduplication/single-flight, hydrate /auth/me, logout/invalidation ที่ถูกต้อง; frontend route protection เพื่อ UX เท่านั้น โดย backend ยังคุมสิทธิ์จริง
- ตรวจ Docker backend build artifact กับ start:prod ว่าพาธตรง; Prisma generate/migrate/seed เฉพาะตามเงื่อนไข; supply prisma config ที่ runner จำเป็นต้องใช้
- ตรวจ frontend NEXT_PUBLIC_* build time vs runtime; LAN/mobile API/socket URLs ใช้งานได้จริงแทน localhost ผิดเครื่อง; CORS configuration ตาม environment
- compose DB/backend readiness/healthcheck; sample .env.example แบบไม่เผย secret; ขั้นตอน local vs prod ที่ชัด
- เปลี่ยน CI ให้ตรวจ lint/test/build/PR อย่างถูกต้อง; ห้าม auto-merge หรือ delete branches หากไม่มีนโยบายที่ได้รับอนุมัติ
- ปรับ README ให้แยก implemented/partial/planned ตามหลักฐาน

Acceptance: refresh หลาย API 401 พร้อมกันไม่แตก; reload/logout/expired access ตรวจได้; fresh clone บน test environment install→generate→migrate→build→start→HTTP smoke test; LAN mobile QR/socket ต่อ server ได้; CI ไม่แก้ branch เอง

ห้ามแก้ prod credentials/deploy/push/merge; แยก environment blockers ออกจาก source bugs และส่งหลักฐานคำสั่ง/ผลทุกครั้ง
```

## Prompt 07 — End-to-End & Regression Readiness Gate (F01–F16)

```text
ทำ final verification ของ Shabu System ทั้งระบบ โดยยึด repository ล่าสุดและ issues F01–F16; ไม่อ้างว่า feature ผ่านหากไม่มีการรันจริง

สร้าง/ปรับ test plan และ automated tests เท่าที่ infrastructure รองรับ ครอบคลุม:
1. OWNER/MANAGER/STAFF/KITCHEN auth/permissions, anonymous API/Socket attempts, cross-session QR and expiry
2. เปิดโต๊ะ→เลือก tier/จำนวนคน→QR→เมนูใน tier→สร้าง order→KDS→served→checkout→payment confirmation→invoice→cleaning→available
3. QR reconnect, stale state, session expiration, menu unavailable, malformed IDs, invalid transitions และ void audit
4. concurrency เปิดโต๊ะซ้ำ/สร้าง invoice ซ้ำ/retry order/payment; DB rollback/idempotency
5. Decimal pricing/discount boundary, QR payload/settings restart, stock adjustments/reconciliation
6. frontend build/lint, backend build/unit/integration, Docker Compose smoke and LAN/mobile path (เฉพาะที่รันได้จริง)

ส่ง Test Matrix: Case ID, requirement/issue, preconditions, steps, expected, actual, PASS/FAIL/BLOCKED/NOT RUN, evidence และ bug references. ส่ง Go/No-Go พร้อมเหตุผล ปัญหา P0 ที่คงค้างต้องเป็น No-Go สำหรับ production public access. แก้เฉพาะ regression ที่ยืนยันและอยู่ในขอบเขต; เรื่องใหญ่ให้เสนอ follow-up แยก ไม่ rewrite ทั้งระบบ

ข้อห้าม: ห้ามใช้เงินจริง/ข้อมูลลูกค้าจริงในการทดสอบ, production migrations, deploy, merge, push, ลบ branch หรือซ่อน failing tests
```

---

## Checklist ปิดงานที่ต้องแนบทุกครั้ง

- [ ] ระบุ branch/commit ที่ตรวจและสถานะ local changes
- [ ] มีหลักฐาน `path:line` จากโค้ดล่าสุดยืนยันแต่ละ issue
- [ ] ระบุ business assumptions/decision blockers ชัดเจน
- [ ] เปลี่ยนโค้ดเฉพาะขอบเขต พร้อมรายชื่อไฟล์ที่แก้และเหตุผล
- [ ] ระบุ API/Socket/ID contract และ compatibility ที่กระทบ
- [ ] หากมี DB change ต้องมี migration, backfill, rollback/recovery และ test DB verification
- [ ] มี unit/integration/e2e regression test สำหรับ happy/negative/edge/concurrency ตามงาน
- [ ] บันทึกคำสั่งจริง + ผล PASS/FAIL/BLOCKED/NOT RUN ไม่กล่าวอ้างเกินหลักฐาน
- [ ] ไม่ deploy, push, merge, delete branch, เปลี่ยน production DB หรือ expose secrets
- [ ] สรุปความเสี่ยงคงค้างและงานถัดไปเป็นภาษาไทย

## Business decisions ที่ต้องยืนยัน

1. OWNER/MANAGER/STAFF/KITCHEN คนใดออกใบเสร็จ/ให้ส่วนลด/void/แก้ payment settings ได้บ้าง?
2. หมดเวลาทานแล้วหยุด order ทันทีไหม ต่อเวลา/คิดค่าปรับหรือไม่? เคลียร์โต๊ะเมื่อใด?
3. ราคายึดที่เปิดโต๊ะหรือ checkout? ผู้ใหญ่/เด็ก, VAT, service charge และ rounding policy?
4. แยกบิลหรือผ่อนชำระได้หรือไม่? ถ้าไม่ หนึ่ง invoice ต่อ session เป็นกติกาที่ต้องยืนยัน
5. Payment เป็น manual confirmation หรือ provider/webhook? ใช้ PromptPay แบบใดและยืนยันรับเงินจริงอย่างไร?
6. Inventory ตัดเมื่อ order/prepare/serve และคืนเมื่อ void ไหน? ถ้าสต็อกไม่พอให้ทำอย่างไร?
7. ใช้งานร้านเดียวผ่าน LAN หรือหลายสาขา/HTTPS? Domain/API/Socket ที่เปิดจากมือถือคืออะไร?
