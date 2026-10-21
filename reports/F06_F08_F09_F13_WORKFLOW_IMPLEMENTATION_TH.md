# ผลตรวจและปรับ QR → Order → KDS → Status (F06/F08/F09/F13)

วันที่ 21 ตุลาคม 2026 — ตรวจจาก commit `bb9de25` และ working tree ปัจจุบัน เริ่มงานโดยไม่มี local changes

## Prerequisite และขอบเขต

อ่าน Audit, implementation prompts, OrdersService/controller/DTO, SessionsService, Prisma models/enums, gateway, customer credential flow, QR/menus/KDS, API/Socket clients และ Next.js docs ที่ติดตั้ง ก่อนแก้โค้ด

ก่อนแก้ F04 ผ่าน ID unit 30 ข้อ; permission unit 8 ข้อ และ F02/F07 integration ผ่าน 29 ข้อกับ HTTP/JWT/PostgreSQL/Socket จริง จึงพร้อมพัฒนา workflow บน local/test ดู [แผนก่อนแก้](F06_F08_F09_F13_WORKFLOW_PLAN_TH.md)

**Blocker สำหรับการใช้งานพนักงานจริงยังมี:** [permission matrix](SECURITY_PERMISSION_MATRIX_TH.md) ยังไม่ได้รับอนุมัติ และต้องกำหนด assignment ผู้ใช้ต่อครัว ไม่เปิด grants ให้ OWNER/MANAGER/STAFF/KITCHEN เอง การทดสอบใหม่ใช้ role `WORKFLOW-<uuid>` และ grants/assignment เฉพาะ fixtures; default-deny เดิมคงอยู่

ไม่มีการแก้ schema/migration/secret จริง/permission policy, ไม่มี deploy/merge/push และไม่มี drop/truncate/reset ฐานข้อมูล ใช้ DB ทดสอบใหม่ `shabu_workflow_1792567507030` บน `127.0.0.1:55432`; รัน regression บน DB ทดสอบ F04/security ที่แยกไว้เดิมเท่านั้น

## สิ่งที่ยืนยันได้จากโค้ดล่าสุด

| Finding | ก่อนแก้รอบนี้ | ผลหลังแก้ |
|---|---|---|
| F06 | service ยังไม่ตรวจ tier/endTime; staff DTO รับ items ว่าง และ quantity ไม่มีเพดาน | ตรวจทั้ง DTO และ service, ใช้ session tier จริง, เวลา server, เมนูพร้อมขาย; ไม่เชื่อ kitchenId จาก client |
| F08 | QR join/reconnect ถูกแก้แล้วบางส่วน แต่ยังมี stale fetch, ไม่มี deadline/closure handler ครบ; KDS cleanup เก็บไว้บน socket คนละ object | join หลัง resolve credential/session และ sync หลัง server ยืนยัน room, rejoin ทุก connect, ป้องกันผล fetch เก่าทับใหม่, cleanup เฉพาะ handler ของหน้า |
| F09 | `void-logs` วางก่อน `:id` แล้ว แต่ menus ยังเรียก `/kitchen-sections` และกลืน error เป็นรายการว่าง | ใช้ client `/kitchens` ร่วมกัน; integration ยืนยัน static route ได้ 200 จริง |
| F13 | VOIDED shortcut ถูกปิดแล้ว แต่ยังย้อน/ข้ามสถานะได้; header/item คนละ transaction และ response เก่า; emit PREPARING ให้ item ที่ไม่ได้แก้ | allowed transitions ชัดเจน, atomic transaction + lock, อ่านผลหลังเปลี่ยนทั้งหมด, emit หลัง commit เฉพาะ item ที่เปลี่ยน |

## Validation และ ownership

- `POST /orders` ยังเป็น staff endpoint; `POST /customer/orders` ยังต้องใช้ signed customer credential และ scope assertion เดิม sessionId อย่างเดียวไม่ให้สิทธิ์
- Normalize UUID/prefixed IDs ด้วย F04 ก่อน query; display number ไม่ใช้เป็น PK
- items ต้องเป็น array ขนาด 1–100; quantity ต้องเป็นจำนวนเต็ม 1–99; ไม่รับเมนูซ้ำแม้ผสม raw/prefixed ID; ไม่รับ client-selected kitchenId
- ขอบเขต 100/99 เป็น technical request limit ที่ใช้ระหว่างยังไม่มีคำตอบต่อข้อเสนอ ไม่ใช่โควตาจำนวนอาหารต่อ session; ค่า backend/frontend/Swagger ตรงกัน
- ภายใน transaction lock session row แล้วตรวจ ACTIVE และ `endTime > Date.now()` แม้ cron ยังไม่ทำงาน พร้อมตรวจ MenuItem.isAvailable และ TierMenuItem ของ tier จริง
- เมนูที่ไม่มีจริง/นอก tier/ไม่พร้อมขาย ตอบ 400 แบบรวม ไม่เปิดเผยรายละเอียดเมนูนอกแพ็กเกจ; session ที่ไม่มีจริงตอบ 404 เมื่อผ่าน staff authorization
- customer auth ตอบ 401 สำหรับ credential ไม่ถูกต้อง/หมดอายุ และ 403 สำหรับ session ปิด/หมดเวลาแต่ JWT ยังตรวจได้ หรือ scope คนละ session; staff create session ที่หมดเวลาตอบ 400
- customer menu คืนเฉพาะเมนูใน tier ที่พร้อมขาย พร้อม field allowlist เดิม; availability event ทำให้หน้า QR อ่านรายการ scoped ใหม่ ไม่เอา payload event มาเพิ่มเมนูโดยตรง

## กติกาสถานะที่บังคับใช้

| Action | อนุญาต | ปฏิเสธ |
|---|---|---|
| ครัว PATCH item status | PENDING → PREPARING → SERVED | ข้ามขั้น, ย้อนสถานะ, same-state, เปลี่ยน terminal state, ส่ง VOIDED โดยตรง |
| POST item void | PENDING/PREPARING → VOIDED ผ่าน `orders.void` เดิม | SERVED/VOIDED, order CANCELLED, เหตุผลว่าง/สั้น/ยาวเกินขอบเขต |
| Staff confirm order | PENDING → CONFIRMED; เปลี่ยนเฉพาะ PENDING items เป็น PREPARING | ยืนยันซ้ำ/ย้อนสถานะ/ฟื้น CANCELLED |
| เมื่อเสิร์ฟรายการสุดท้าย | คงพฤติกรรมเดิม: หากทุกรายการ SERVED/VOIDED ให้ PENDING header เป็น CONFIRMED ใน transaction เดียวกัน | ไม่ฟื้น CANCELLED และไม่เขียน header ซ้ำที่ยืนยันแล้ว |
| Cancel ทั้ง order | **ยังปิดไว้ทั้งหมด** ระหว่างรอกติกาที่อนุมัติ | ไม่ cascade void/refund และไม่แต่งผลข้างเคียงเอง |

ผู้ใช้ยังไม่ได้ตอบคำถามเรื่อง cancellation จึงใช้ safe-deny ปุ่ม cancel ทั้ง order ถูก disable พร้อมคำอธิบาย API ปฏิเสธด้วย 400 ส่วนข้อมูล CANCELLED เก่ายังอ่านได้

Void reason trim ก่อนตรวจความยาว 3–1000 และบันทึก actor จาก authenticated user ฝั่ง server การเขียน item + VoidLog อยู่ transaction เดียว ใช้ order row lock สำหรับ confirm/item/void และ Serializable isolation; serialization conflict ตอบ 409 ให้โหลดข้อมูลก่อนลองใหม่ ไม่ retry สร้าง order อัตโนมัติ

ไม่ทำ auto-void, auto-refund, inventory deduction หรือแก้ข้อมูลย้อนหลัง

## Socket และ frontend

- Event session เดิม `order:status_changed` / `order:item_status_changed` คงชื่อและ projection ฝั่ง customer
- เพิ่ม `kitchen:item_status_changed` แบบ additive ส่งเฉพาะ kitchen room ที่ตรง item และ revalidate staff permission + assignment ก่อนส่ง; customer ไม่ได้รับ kitchen payload
- Service ส่ง event หลัง transaction สำเร็จเท่านั้น response/item event ใช้ข้อมูลที่เปลี่ยนแล้ว ไม่ emit PREPARING ให้ SERVED/VOIDED หรือ item ที่ PREPARING อยู่ก่อน
- QR รอ `session:joined` แล้ว sync ประวัติ; KDS รอ `kitchen:joined` แล้ว sync รายการ; reconnect auth/join ใหม่และอ่านข้อมูลล่าสุดชดเชย event ที่พลาด
- ใช้ request generation และ token guard กัน stale responses/ผลจากหน้าเก่า; unmount/closure invalidate งานค้าง; แยก listener และ cleanup ด้วย function เดิม ไม่ใช้ broad `off(event)` ใน QR/KDS ที่แก้
- QR รับ session status, หยุดสั่งที่ endTime, ล้าง credential/cart และแสดงข้อความปิด/หมดเวลา เมื่อ backend ปิด session การ revalidate ของ gateway จะ disconnect customer; หน้า QR แลก credential ใหม่แล้วแสดง error จาก session ที่ปิด โดยไม่อนุญาตอ่านข้อมูลต่อหลัง closure
- KDS อ่านเฉพาะ kitchen assignments, map orderId/createdAt จาก order จริง และแสดงสถานะเชื่อมต่อ; เมื่อ fetch ไม่สำเร็จแสดง error แทนแสดงความสำเร็จเงียบ ๆ
- POS หยุดส่ง kitchenId ที่ DTO ไม่รับ และหยุด emit `new-order` ที่ไม่มี handler; backend เป็น producer หลัง commit; Socket/DTO types ปรับตาม contract จริง

## ไฟล์ที่แก้และเหตุผล

| ไฟล์ | เหตุผล |
|---|---|
| `backend/src/orders/orders.service.ts` | validation, transaction/locking, audit, truthful response/events |
| `backend/src/orders/order-rules.ts` (ใหม่) | bounds และ explicit transition rules |
| `backend/src/orders/dto/{create-order,update-order-status,update-item-status,void-item}.dto.ts` | HTTP validation และ Swagger descriptions |
| `backend/src/customer/customer.controller.ts` | request bounds และ scoped available menu |
| `backend/src/events/events.gateway.ts` | secured kitchen item-status event เพิ่มเติม |
| `frontend/src/lib/workflow-client.ts` (ใหม่) | canonical kitchen API, room sync/cleanup, request generation, UI bounds |
| `frontend/src/app/order/[token]/page.tsx` | credential/session lifecycle, reconnect sync, expiry, stale fetch, cart bounds |
| `frontend/src/app/(dashboard)/kds/page.tsx` | kitchen auth/join/sync/cleanup, correct item metadata, server events |
| `frontend/src/app/(dashboard)/menus/page.tsx` | `/kitchens` dropdown client และไม่กลืน kitchen API error |
| `frontend/src/app/(dashboard)/orders/page.tsx` | disable whole-order cancellation ที่ยังไม่อนุมัติ |
| `frontend/src/app/(dashboard)/pos/page.tsx`, `frontend/src/types/index.ts` | producers/types ให้ตรง REST/Socket contract |
| `backend/src/orders/order-rules.spec.ts`, `backend/test/workflow.e2e-spec.ts` (ใหม่) | transition matrix + real REST/DB/Socket regression |
| `frontend/test/workflow-clients.test.mjs` (ใหม่) | kitchen client, reconnect, room ack sync, stable cleanup/remount, stale request rejection |
| `backend/src/orders/orders-id.spec.ts`, `backend/test/id-contract.e2e-spec.ts` | fixtures มี active endTime และ tier membership ตาม contract ใหม่ โดยคง ID assertions |
| `backend/test/{create-workflow-db.cjs,jest-workflow-e2e.json}` (ใหม่), package scripts | opt-in isolated test setup และคำสั่งรันซ้ำ |
| `backend/test/local-start-smoke.cjs` | รองรับ workflow test DB/evidence directory แยก ไม่เขียนทับ evidence เก่า |

Source diff ทั้งไฟล์เดิมและไฟล์ใหม่อยู่ใน [code-changes.patch](workflow-evidence/code-changes.patch); [รายการไฟล์](workflow-evidence/changed-code-files.json) ไม่มี dependency/lockfile/schema/migration/Docker/CI changes

## ผลคำสั่งที่รันจริง

ตัวแปร DB/signing keys เป็นค่าทดสอบเฉพาะ local ดู [local command results](workflow-evidence/local-check-results.json), [integration/build results](workflow-evidence/integration-build-results.json) และ log ที่ลิงก์จากแต่ละรายการ

| คำสั่ง / cwd | ผล | Exit | หลักฐาน |
|---|---|---|---|
| `npm run test:workflow:db` / backend | PASS — สร้าง DB ใหม่และ migrate deploy | 0 | [log](workflow-evidence/create-db.log) |
| `npm run test:workflow` / backend | PASS 25 tests | 0 | [log](workflow-evidence/backend-workflow-unit.log) |
| `npm run test:workflow:e2e` / backend | PASS 21 tests; HTTP/JWT/PG/Socket จริง | 0 | [log](workflow-evidence/workflow-e2e-final.log) |
| `npm run test:ids` / backend | PASS 30 tests | 0 | [log](workflow-evidence/backend-id-unit.log) |
| `npm run test:ids:e2e` / backend | PASS 6 tests | 0 | [log](workflow-evidence/id-e2e.log) |
| `npm run test:security` / backend | PASS 8 tests | 0 | [log](workflow-evidence/backend-security-unit.log) |
| `npm run test:security:e2e` / backend | PASS 29 tests | 0 | [log](workflow-evidence/security-regression-final.log) |
| `npm run test:workflow` / frontend | PASS 4 tests | 0 | [log](workflow-evidence/frontend-workflow.log) |
| `npm run test:security`, `npm run test:ids` / frontend | PASS 3 + 3 tests | 0 ทั้งคู่ | [security](workflow-evidence/frontend-security.log), [IDs](workflow-evidence/frontend-id.log) |
| scoped backend/frontend workflow ESLint | PASS ไม่มี errors/warnings ใน scope ที่ตรวจ | 0 | [backend](workflow-evidence/backend-lint-final.log), [frontend](workflow-evidence/frontend-lint-final.log) |
| `tsc --noEmit` / frontend | PASS | 0 | [log](workflow-evidence/frontend-types.log) |
| `npm run build` / backend | PASS | 0 | [log](workflow-evidence/backend-build.log) |
| `NEXT_PUBLIC_API_URL=http://localhost:3000 NEXT_PUBLIC_SOCKET_URL=http://localhost:3000 npm run build` / frontend | PASS หลัง retry ด้วย network permission; รอบ sandbox fetch Google Font ไม่ได้ exit 1 | 0 รอบสุดท้าย | [final](workflow-evidence/frontend-build-final.log), [sandbox failure](workflow-evidence/frontend-build.log) |
| `ALLOW_SHABU_TEST_DB=1 SHABU_SMOKE_SUITE=workflow DATABASE_URL=<workflow DB> npm run test:local-start` / backend | PASS backend Swagger 200 / anonymous data 401 / DB login negative 401; frontend login/QR routes 200; หยุด child processes แล้ว | 0 | [log](workflow-evidence/local-start-final.log) |
| `git diff --check` | PASS | 0 | [log](workflow-evidence/diff-check.log) |
| `npm test -- --runInBand` / backend | **FAIL** 25 suites; 6 suites PASS; tests 24 FAIL / 63 PASS | 1 | [log](workflow-evidence/backend-full-tests.log) |
| ESLint menus/orders/POS/types ที่มีโค้ดเดิม | **FAIL** 7 errors / 17 warnings; เทียบ HEAD ได้จำนวนเท่ากันทุกไฟล์ | 1 | [comparison](workflow-evidence/frontend-legacy-lint-comparison.json), [log](workflow-evidence/frontend-legacy-pages-lint.log) |
| Browser/มือถือจริง, multi-process Socket adapter, load/chaos test | **NOT RUN** | — | ไม่มี browser automation ในรอบนี้; ไม่อ้างว่า render smoke คือ browser acceptance |

รวม tests ในชุดที่เจาะ scope และ regression ผ่าน **129 ข้อ** (ไม่บวกซ้ำ full-suite) ไม่ถือว่า repository test ทั้งหมดผ่าน

Full backend failures เป็น baseline scaffold ที่ไม่ได้ inject dependencies และไฟล์ `kitchens/kitechens.controller.spec.ts` import ชื่อไฟล์ผิด เช่นเดียวกับรายงานก่อนหน้า ไม่แก้/ซ่อน/skip เพื่อทำผลเขียว

การรัน integration ครั้งแรกใน sandbox ติด EPERM ที่ localhost แล้ว rerun ด้วยสิทธิ์ที่อนุญาตจึงผ่าน การเขียน test ใหม่ครั้งแรกมีรูปแบบ `it.each` ผิด ทำให้ 9 FAIL / 10 PASS; แก้เฉพาะ test data wrapper แล้วเพิ่มกรณีทดสอบจน final 21 PASS เก็บ [initial failure](workflow-evidence/workflow-e2e-initial.log) ไว้ตรวจย้อนหลัง

## Acceptance ที่ตรวจได้

| เกณฑ์ | ผลและขอบเขต |
|---|---|
| นอก tier / หมดเวลา / ไม่พร้อมขาย / ว่าง / qty ไม่ถูกต้อง | PASS โดยเรียก customer และ staff API ตรง พร้อมตรวจไม่สร้าง order เพิ่ม |
| QR → KDS → kitchen update → customer; reconnect | PASS ผ่าน real HTTP/Socket และอ่าน DB/ประวัติ/KDS อีกครั้ง; client lifecycle helper PASS; browser UI จริง NOT RUN |
| void logs route / kitchen dropdown | API route และ client mapping PASS; dropdown บน browser จริง NOT RUN |
| void ทุกครั้งมี actor/reason และ invalid transitions ถูกปฏิเสธ | PASS ทั้ง PENDING/PREPARING, served/voided rejection, shortcut, concurrent void และ VoidLog failure rollback |
| API/DB/event หลัง transaction ตรงกัน | PASS: served/voided ไม่ถูก emit PREPARING; item/header rollback เมื่อบังคับ DB ล้มเหลว ไม่มี success events |
| ปิด/หมด session แจ้งและหยุดสั่ง | backend disconnect/reject + atomic table state PASS; QR closure/deadline handlers และ stale-request helper ตรวจแล้ว; browser notification จริง NOT RUN |

## Compatibility, risks และสิ่งที่ยังรอ

1. REST paths/ID aliases/QR URLs/credential signing contract เดิมคงอยู่ เพิ่ม kitchen event เท่านั้น; clients เก่าที่ส่ง kitchenId, qty >99, VOIDED ผ่าน PATCH, ข้าม/ย้อนสถานะ หรือ cancel ทั้ง order ต้องปรับตาม documented contract จัดการ frontend/backend พร้อมกันตาม source diff นี้
2. ต้องอนุมัติ permission matrix และ kitchen assignment สำหรับพนักงานจริงก่อนใช้งาน default-deny ทำให้ unconfigured staff ยัง 403 ตามที่ตั้งใจ
3. Cancellation semantics ยังเป็น business blocker และปิดไว้ทั้งหมด ไม่ได้อนุมานวิธี void/refund เมื่อยกเลิก header; technical bounds 100/99 ระบุเป็นค่าเริ่มต้นที่ต้องทบทวนหากร้านต้องใช้ค่าอื่น
4. Socket delivery ยังไม่มี durable outbox/replay หลัง process crash ระหว่าง commit กับ emit ข้อมูล DB ไม่ย้อนกลับ แต่ client ต้อง reconnect/refetch; ไม่อ้าง exactly-once delivery หรือรับประกันลำดับ event ข้าม concurrent transactions
5. Row locking/Serializable อาจทำให้ได้ 409 เมื่อมีคำสั่งพร้อมกัน client ต้อง reload ก่อนตัดสินใจ retry การสั่งซ้ำหลัง network timeout ยังไม่มี idempotency key (ไม่ได้เพิ่มอัตโนมัติใน scope นี้)
6. UI deadline อาศัยนาฬิกา client เพื่อแจ้งเตือน ส่วนสิทธิ์สั่งจริงตัดสินด้วยเวลา server; อุปกรณ์เวลาเพี้ยนอาจแสดงคำเตือนคลาดเคลื่อน
7. หน้า staff orders/POS มี lifecycle/listener patterns เดิมบางส่วนที่ไม่ได้ rewrite ในรอบนี้ แก้เฉพาะ payload/cancel compatibility ที่เกี่ยวข้อง; QR/KDS เป็น consumer ที่ปรับครบตาม scope
8. ย้อน code ต้องย้อน frontend/backend ส่วน workflow ร่วมกัน ไม่ย้อน security prerequisite และไม่ต้องย้อน migration เพราะรอบนี้ไม่มี migration ใหม่

ไม่มี deploy/merge/push และเก็บข้อมูล fixtures ใน DB ทดสอบไว้ ไม่มีการลบข้อมูลเดิม
