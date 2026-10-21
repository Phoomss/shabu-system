# Prompt 0 — ผลตรวจยืนยัน Audit และ Build Baseline

วันที่ตรวจ: 21 ตุลาคม 2026 (Asia/Bangkok)  
ขอบเขต: ดำเนินการเฉพาะ Prompt 0 ใน `SHABU_CODEX_IMPLEMENTATION_PROMPTS_TH.md:27` เทียบกับ `reports/SYSTEM_AUDIT_FOR_GPT_TH.md` ไม่ได้ดำเนินการ Prompt 01–07

## ผลที่ควรทราบก่อน

หลังติดตั้งตาม lockfile และ generate Prisma Client แล้ว **backend build และ frontend production build ผ่าน** บน Node 25.9.0 แต่ backend `start:prod` ไม่ผ่าน เพราะ entrypoint ไม่ตรงกับ output ที่ build ได้ ทั้งสองแอป lint ไม่ผ่าน และชุด Jest เดิมหยุดที่การ resolve import ก่อนรัน test cases

ข้อค้นพบหลัก F01–F16 ยังมีหลักฐานอยู่ใน source code โดย F10 เรื่องผลของคำขอพร้อมกันยังต้องพิสูจน์กับ test DB ส่วน F15 ข้อสงสัยว่า serialization ซ้อนชั้นทำให้ hydrate พัง **ยังทำซ้ำไม่ได้** ในการทดลอง roundtrip แยกส่วน ไม่ควรสรุปเป็นบั๊กที่ยืนยันแล้ว

มี diagnostic probes 13 รายการที่เรียกโค้ดจริงจาก build พร้อมข้อมูลจำลองในหน่วยความจำ เพื่อพิสูจน์พฤติกรรมบางข้อโดยไม่ใช้ DB ผลเหล่านี้ไม่ใช่ E2E ผ่าน และไม่ได้พิสูจน์ความพร้อม production

## 1. สถานะ Repository และการรักษา local changes

- ตอนเริ่ม: branch `main`, HEAD `f18cb42`; tracked working tree ไม่มี diff; มี untracked `SHABU_CODEX_IMPLEMENTATION_PROMPTS_TH.md` และ `reports/`
- ระหว่างตรวจพบ repository เปลี่ยนเป็น branch `fix/fix-all-system`, HEAD `c23a6a3` (`report system fix`) โดยไม่ได้สั่ง commit/checkout/merge จากการตรวจนี้
- diff `f18cb42..c23a6a3` มีเฉพาะเอกสาร prompt/audit และ evidence logs บางไฟล์ ไม่มีการเปลี่ยน application source, lockfiles, schema, migrations, Docker หรือ CI จึงยังเทียบพฤติกรรมกับฐานเดิมได้
- เพิ่มรายงานนี้และหลักฐานการตรวจใน `reports/prompt0-evidence/`; ไม่แก้ business logic, package.json, lockfiles, test/config เดิม, Docker/CI หรือข้อมูลจริง
- ไม่ deploy/push/merge/delete branch และไม่รัน seed/migration/db push/reset ไม่เปิดฐานข้อมูลหรือบริการร้านจริง
- การติดตั้งเพิ่มเฉพาะ ignored `node_modules`; build/generate สร้าง artifacts ใน ignored output directories

SHA-256 lockfiles ก่อนและหลังตรงกัน:

```text
backend/package-lock.json
846f3833e9cf15d7fc7aa71e9167237eff505d954818b0208fed5032b40062eb
frontend/package-lock.json
4af63c0abeaf7deab101b70bbebae88b6ac82052a54a639fdc762972014e68b9
```

## 2. Environment และ dependencies

| รายการ | ผลตรวจ |
|---|---|
| เครื่องตรวจ | Node `v25.9.0`, npm `11.12.1` |
| Package manager | ทั้งสองแอปมี npm lockfile v3; ไม่มี `.nvmrc`/`.node-version` ในไฟล์ที่ค้นพบ และ package.json ไม่กำหนด packageManager |
| CI / Docker | ใช้ Node 20; ไม่ได้ตรวจซ้ำบน Node 20 ในรอบนี้ |
| เวอร์ชันจาก lockfile | Nest core 11.1.16, Prisma/client 7.4.2, Next 16.2.1, React 19.2.4, Zustand 5.0.12 |
| Engine constraints | Prisma `^20.19 || ^22.12 || >=24.0`; Next `>=20.9.0`; Nest core `>=20` |
| README | root README:347 ระบุ Node >=18 ซึ่งต่ำกว่า constraints ของ dependencies ปัจจุบัน |
| ติดตั้ง | `npm ci` ทั้งสองแอปสำเร็จ ไม่ upgrade และไม่แก้ lockfile |
| Docker | CLI มี แต่ Docker daemon socket ไม่มี; ไม่ได้เริ่ม daemon/สร้าง container |
| PostgreSQL | ไม่ใช้ DB ในรอบนี้; ไม่มีการรันคำสั่งที่แก้ schema/data |

การติดตั้งใน sandbox รอบแรก exit 1 พร้อม `ENOTFOUND registry.npmjs.org` ใน npm debug log และข้อความ `Exit handler never called!` จึง retry ด้วยการอนุญาตเข้าถึงเครือข่ายแล้วสำเร็จ การแจ้ง deprecated packages ไม่ใช่ผล vulnerability audit

Prisma generate/validate และคำสั่งทดสอบที่เกี่ยวข้องใช้ URL จำลอง `postgresql://audit:audit@127.0.0.1:1/shabu_prompt0_test` เพื่อไม่ใช้ DB จริง ไม่ได้เปิดเผยค่าจากไฟล์ secrets

## 3. ผลคำสั่งจริงและ exit codes

คำสั่งที่ระบุ path แบบสัมพันธ์ในตารางให้รันจาก directory ของแอป ยกเว้น diagnostic probes และ docker info ที่รันจาก root คำสั่ง full สำหรับติดตั้งใช้ `--no-audit --no-fund --fetch-retries=0 --fetch-timeout=20000` และ cache แยกใต้ `/private/tmp/shabu-prompt0-{backend,frontend}-cache`

| คำสั่ง | Exit | ผลและประเภท | หลักฐาน |
|---|---:|---|---|
| backend `npm ci` หลังอนุญาต network | 0 | เพิ่ม 870 packages; local setup ผ่าน | ผล tool ระหว่างตรวจ; ไม่มี raw install log ใน repo |
| frontend `npm ci` หลังอนุญาต network | 0 | เพิ่ม 710 packages; local setup ผ่าน | ผล tool ระหว่างตรวจ; ไม่มี raw install log ใน repo |
| backend `node node_modules/prisma/build/index.js generate` | 0 | Prisma Client 7.4.2 generate ผ่าน; ไม่แตะ DB | [prisma-generate.log](prompt0-evidence/prisma-generate.log) |
| backend `node node_modules/prisma/build/index.js validate` | 0 | schema syntax/config valid; ไม่ยืนยัน migration completeness | [prisma-validate.log](prompt0-evidence/prisma-validate.log) |
| backend `npm run build` | 0 | compile ผ่าน; เดิม 293 errors จาก dependency setup ไม่ใช่ 293 bugs | [backend-build.log](prompt0-evidence/backend-build.log) |
| backend `npm run start:prod` | 1 | source/config failure: หา `backend/dist/main` ไม่พบ; output จริง `dist/src/main.js` | [backend-start-prod.log](prompt0-evidence/backend-start-prod.log) |
| backend `node node_modules/eslint/bin/eslint.js '{src,apps,libs,test}/**/*.ts'` | 1 | source lint failure: 412 problems = 386 errors + 26 warnings; ไม่ใช้ --fix | [backend-lint.log](prompt0-evidence/backend-lint.log) |
| backend `npm test -- --runInBand` | 1 | 25 suites failed to run, **0 tests executed**; import alias และไฟล์สะกดผิด | [backend-unit-tests.log](prompt0-evidence/backend-unit-tests.log) |
| backend `npm run test:e2e -- --runInBand` | 1 | 1 suite failed to run, **0 tests executed**; import alias; ไม่ได้เข้าถึง DB | [backend-e2e-tests.log](prompt0-evidence/backend-e2e-tests.log) |
| backend targeted AuthService test พร้อม CLI moduleNameMapper override | 1 | 1 suite/1 test fail เพราะ DI ไม่มี PrismaService; ไม่ได้เปลี่ยน Jest config ใน repo | [auth-test-resolver-override.log](prompt0-evidence/auth-test-resolver-override.log) |
| frontend `npm run lint` | 1 | source lint failure: 135 problems = 60 errors + 75 warnings | [frontend-lint.log](prompt0-evidence/frontend-lint.log) |
| frontend `npm run build` ใน sandbox | 1 | environment/network failure: ดาวน์โหลด Inter จาก Google Fonts ไม่ได้ | [frontend-build.log](prompt0-evidence/frontend-build.log) |
| frontend `npm run build` หลังอนุญาต network | 0 | compile + TypeScript + prerender ผ่าน; มี middleware deprecation warning | [frontend-build-network.log](prompt0-evidence/frontend-build-network.log) |
| root `node reports/prompt0-evidence/verify-current-code.cjs` | 0 | diagnostic probes 13 ข้อได้ผลตามที่บันทึก; ไม่ใช่ functional acceptance PASS | [diagnostic-probes.log](prompt0-evidence/diagnostic-probes.log) |
| root `docker info --format '{{.ServerVersion}}'` | 1 | environment failure: ไม่พบ daemon socket | [docker-info.log](prompt0-evidence/docker-info.log) |

คำสั่ง targeted test ที่ใช้จริง:

```sh
npm test -- --runInBand --runTestsByPath src/auth/auth.service.spec.ts \
  --moduleNameMapper '{"^src/(.*)$":"<rootDir>/$1"}'
```

ไม่ได้ใช้ backend `npm run lint` เพราะ script มี `--fix` ใช้ ESLint โดยตรงแทน Frontend ไม่มี test script ใน package.json จึงไม่มีผล frontend unit/E2E suite

## 4. ผลเทียบ F01–F16

สถานะ `Confirmed` = ยืนยัน implementation/ช่องว่างจากโค้ดปัจจุบัน ไม่ได้หมายความว่าทดสอบโจมตีหรือ E2E ครบแล้ว; ตารางระบุชัดเมื่อมีการทดลองแบบใช้ doubles  
`Needs runtime verification` = ต้องทดสอบพฤติกรรมจริงเพิ่ม; `Not reproducible` = ข้อสงสัยเฉพาะส่วนนั้นทำซ้ำไม่ได้; `Changed` = หลักฐานต่างจาก audit เดิม ไม่พบการเปลี่ยน application source ที่ทำให้ issue หาย

| ID | สถานะ / Severity | หลักฐานปัจจุบัน path:line | Dependencies และแนวทางแก้ในงานถัดไป |
|---|---|---|---|
| F01 | Confirmed / P0 | `backend/src/role/role.controller.ts:8` ไม่ใส่ guard; `backend/src/user/user.controller.ts:24` JWT เท่านั้น; `backend/src/app.module.ts:22` ไม่มี global role guard; probe ตรวจ metadata แล้ว | ตกลง permission matrix แล้วบังคับ role/action ฝั่ง server; ขึ้นกับการตัดสินสิทธิ์ |
| F02 | Confirmed / P0 | `backend/src/orders/orders.controller.ts:34` และ `:40` ไม่มี guard; `orders.service.ts:31` ไม่มี sessionId แล้ว query where=undefined; probe ยืนยัน query | ต้องประสาน F04/F07; แยก staff listing กับ QR credential ที่ผูก session |
| F03 | Confirmed / P0 | `backend/src/invoices/invoices.service.ts:55` เชื่อ dto.totalAmount; `invoices/dto/create-invoice.dto.ts:16` ไม่ตรวจส่วนลดเทียบยอด; probe total=100/discount=150 ส่ง net=-50 ไป create | ต้องกำหนดราคาที่อ้างอิง/ส่วนลด/การปัดเศษ แล้วคิดยอดฝั่ง server; ประสาน F10/F11 |
| F04 | Confirmed / P1 | `sessions.service.ts:171` encode ID; `orders.service.ts:50` ไม่ decode; QR `frontend/src/app/order/[token]/page.tsx:199` ส่ง prefixed ID; `sessions.service.ts:130` ใช้ tableId ที่แปลงแล้ว; probes ยืนยันส่ง `ses_...` และ `tbl_000001` เข้า query | เป็นฐานให้ F02/F06/F08/F10/F11; กำหนด boundary/raw/display ID contract และรักษา API compatibility |
| F05 | Confirmed (schema/SQL) / P1 | `backend/prisma/schema.prisma:53`, `:132`, `:151`, `:199` มี 4 sequential fields แต่ SQL ใน `backend/prisma/migrations/` ทั้ง 4 migrations ไม่มี; validate ผ่านไม่ได้หักล้างข้อขาดนี้ | เพิ่ม migration/backfill ไม่แก้ประวัติเดิม; ต้องพิสูจน์ empty/existing test DB ในงานถัดไป |
| F06 | Confirmed / P1 | `orders.service.ts:48` ไม่ตรวจ endTime/tier; `orders/dto/create-order.dto.ts:21` ไม่ห้าม empty items; หน้า QR `:129` โหลดเมนูทั้งหมด; service probe รับ past-endTime ACTIVE + เมนูนอก tier; DTO probe รับ items=[] | ทำหลัง ID/auth; บังคับ server time/tier/quantity และกรอง UI ตาม session |
| F07 | Confirmed (handler/metadata) / P0 | `events.gateway.ts:28`, `:40` รับ join โดยไม่ตรวจ credential; `:115`, `:126` broadcast stock/invoice; probe เรียก join ด้วย client ไม่มี auth แล้วเข้า rooms ได้ | ประสาน F01/F02/F04; เพิ่ม handshake+room authorization และ staff-only events; network Socket E2E ยังไม่ทดสอบ |
| F08 | Confirmed (source); browser effects ยังต้องตรวจ / P1 | QR page `:62` effect, `:95` closure, `:138` setSession แล้ว fetchOrders, `:149` อ่าน session เดิม; ทั้งไฟล์ไม่มี session:join; `:208` emit new-order ที่ gateway ไม่รับ | หลัง F02/F04/F07; join/rejoin หลัง resolve session, stable listeners และ fetch ด้วย ID ที่ถูกต้อง |
| F09 | Confirmed / P1 | `frontend/src/app/(dashboard)/menus/page.tsx:77` เรียก /kitchen-sections; backend `kitchens.controller.ts:11` ใช้ /kitchens; `orders.controller.ts:47` อยู่ก่อน `:97`; probe initialize Nest/Express router จริงแล้ว first match เป็น /orders/:id | endpoint consistency และจัด static/dynamic routes; HTTP จริงยังไม่รัน แต่ route matching ยืนยันใน runtime แล้ว |
| F10 | Needs runtime verification / P1 | `sessions.service.ts:71` ตรวจสถานะก่อน transaction `:88`; `invoices.service.ts:46` ก่อน `:59`; schema ไม่ unique invoice.sessionId และไม่มีข้อจำกัดหนึ่ง active session ต่อโต๊ะ | ความเสี่ยงยืนยันจาก structure แต่ยังไม่ยิง concurrency กับ DB; ตกลงแยกบิลก่อนเลือก constraint/atomic update/idempotency |
| F11 | Confirmed / P1 | `sessions.service.ts:154` expiry→EXPIRED; `:129` CLEANING; invoice `:51` รับเฉพาะ ACTIVE; probe EXPIRED ถูก reject ก่อน write | ต้องแก้ F04 และออกแบบ unpaid/expired/closed/table states ก่อน; แยกเวลาสั่งจากสิทธิ์ชำระ |
| F12 | Confirmed (source/instance behavior) / P1 | invoices page `:538`, `:768` QR value เป็นเบอร์ตรงๆ; `settings.service.ts:10` เก็บใน memory; probe instance ใหม่คืน null | กำหนด manual/provider confirmation และ payment QR spec; persist settings พร้อมสิทธิ์; ยังไม่สแกนธนาคาร |
| F13 | Confirmed / P1 | `update-item-status.dto.ts:7` รับ enum VOIDED; `orders.service.ts:203` update ตรง; probe VOIDED สำเร็จแม้ไม่มี voidLog model; `:120` snapshot ก่อน updateMany `:128` แล้ว emit ทุก item `:139` | ตกลง transitions/void rights แล้วทำ transaction+audit+event หลัง commit; พึ่ง F01/F07 |
| F14 | Confirmed (design gaps); concurrency ต้องตรวจ / P2 | `ingredients.service.ts:42` read-modify-write, `:56` new/previous ratio; OrdersService ไม่ใช้ Recipe/stock; schema ไม่มี stock movement ledger | ตกลงจุดตัด/คืน stock และ units หลัง F13; ทดสอบ lost update กับ DB ภายหลัง |
| F15 | Confirmed บางส่วน; serialization failure Not reproducible / P2 | `authStore.ts:19` adapter, `:43` key แยก; `lib/api.ts:21` ไม่มี refresh coalescing และ `:29` ไม่ set Zustand; `middleware.ts:12` ปล่อยผ่าน; dashboard layout `:84` ไม่ set user จาก /me | probe setAuth→สร้าง store ใหม่ hydrate user/token ได้; **ยังไม่ควรแก้ adapter เพียงเพราะมี stringify สองชั้น**; ปัญหาแหล่ง auth หลายชุด/refresh/route permission ยังต้องจัดการและทดสอบ browser |
| F16 | Confirmed; baseline evidence Changed / P1 | `backend/package.json:13` start:prod ใช้ dist/main แต่ build จริงอยู่ dist/src/main.js; Jest alias ไม่ map และ `kitchens/kitechens.controller.spec.ts:2` import ไฟล์ไม่มีจริง; Docker/CI ยังเหมือนเดิม | backend/frontend build ผ่านเมื่อ deps/network พร้อม; แก้ entrypoint/test harness ก่อนทำ workflow tests; คง compatibility ไม่ขยายไป deploy/merge |

ข้อที่ต้องปรับความเข้าใจจาก Audit เดิม:

1. ไม่มี 293 source bugs ที่ยืนยันจาก build: หลัง setup backend compile exit 0
2. Frontend build ผ่านเมื่อเข้าถึง Google Fonts ได้ จึงแยก network failure ออกจาก source failure; lint ยัง fail แม้ build ผ่าน
3. F09 route shadowing เปลี่ยนจากข้อสงสัยเป็นผล match จริงของ router ที่ Nest ลงทะเบียน โดยใช้ guard override เฉพาะใน diagnostic module และไม่เปิด HTTP port
4. F16 entrypoint mismatch เปลี่ยนจาก “อาจเกิด” เป็น start:prod failure ที่ทำซ้ำได้
5. ชุด Jest fail ก่อนถึง assertions หลัก จึงไม่ใช่ 25 business behavior tests ที่ fail; เมื่อ override เฉพาะ resolver ของ AuthService จึงพบ DI failure จริงเพิ่มอีกชั้น
6. การ encode/decode storage สองชั้นใน F15 ไม่ใช่หลักฐานว่า hydration พังเสมอ เพราะ roundtrip สมดุลทำงานได้ใน probe; browser refresh/concurrent 401 ยังไม่ทดสอบ

## 5. Dependency graph

```mermaid
flowchart LR
  UI[Staff POS / Admin / KDS] --> API[Axios staff client + JWT]
  QR[Customer QR page] --> PUB[Public Axios client]
  API --> CTRL[Nest controllers]
  PUB --> CTRL
  CTRL --> SVC[Sessions / Orders / Invoices / Menu / Inventory services]
  AUTH[Auth + JWT strategies] --> PRISMA[Global PrismaService]
  SVC --> PRISMA
  PRISMA --> PG[PostgreSQL]
  SVC --> EVENTS[Global EventsGateway]
  EVENTS --> WS[Socket.IO client singleton]
  WS --> UI
  WS --> QR
  CRON[Schedule EVERY_MINUTE] --> SESS[SessionsService.checkSessionTime]
  SESS --> SVC
  ID[Global IdTransformer] --> SVC
```

AppModule รวม Config/Schedule/Prisma/Events/IdTransformer และ modules ของแต่ละโดเมน PrismaService ใช้ adapter-pg และเชื่อม DB ใน onModuleInit; diagnostic probes จึงไม่ import AppModule หรือสร้าง PrismaService instance ส่วน SettingsService inject PrismaService แต่เก็บค่าจ่ายเงินใน field ของตัวเอง

ลำดับ dependencies สำหรับแก้: setup/test harness + ID/migration → REST/Socket authorization → QR/KDS/state transitions → checkout/concurrency/payment → stock/auth lifecycle/CI

## 6. API contract ปัจจุบัน

นี่คือ implementation ปัจจุบัน ไม่ใช่ contract ที่เสนอใหม่ Global HTTP response ใช้ `{status,message,data}` และ error ผ่าน AllExceptionsFilter (`backend/src/common/response.interceptor.ts:22`, `backend/src/common/all-exceptions.filter.ts:14`)

| กลุ่ม API | Requests สำคัญ | Auth ปัจจุบัน / ข้อมูลสำคัญ |
|---|---|---|
| /auth | POST login/logout/refresh; GET me | login public; logout/me JWT; refresh ใช้ cookie refresh_token; access 15m/refresh 7d |
| /role | POST/GET, GET/PATCH/DELETE :id | ไม่มี guard; integer role ID |
| /users | CRUD, :id | JWT เท่านั้น; raw UUID; roleId integer |
| /tables, /categories, /kitchens, /tiers, /ingredients | CRUD; tables/:id/status; ingredients/:id/stock | JWT เท่านั้น; integer IDs; stock body amount |
| /menu-items | GET all; CRUD; GET by-tier/:tierId; PATCH :id/availability | GET all public; อื่นๆ JWT; menu UUID, categoryId/kitchenId/tierIds integer |
| /sessions | POST {tableId,tierId,adultCount,childCount}; GET all/:id; PATCH :id/status | JWT; input create ใช้ integers; response session/table/tier เป็น prefixed IDs |
| /sessions/qr/:token | GET | public; lookup QR UUID แล้วตรวจ status ACTIVE; return session+table+tier+menu relations |
| /orders | POST {sessionId,items:[{menuItemId,quantity}]}; GET ?sessionId | public; raw session UUID ถูกใช้ตรง DB; optional filter ไม่บังคับ |
| /orders/:id/status, /orders/items/:itemId/status | PATCH status | JWT เท่านั้น; raw UUID; enums ไม่มีครบ transition guards |
| /orders/kitchen/:kitchenId | GET | JWT; integer kitchenId; query ไม่จำกัดเฉพาะ pending ตามชื่อ summary |
| /orders/items/:itemId/void | POST {reason} | JWT; actor=req.user.id; ไม่มี role guard |
| /orders/void-logs | GET | JWT แต่ dynamic route จับก่อนตามผล probe |
| /invoices | POST {sessionId,totalAmount,discount?,paymentMethod,promptPayNumber?}; GET all/:id | JWT; decode sessionId; encode invoice/session/createdBy ใน response; actor จาก JWT |
| /invoices/stats/total-revenue | GET | JWT; SUM netAmount; ไม่ถูก :id ดักแบบ void-logs เพราะจำนวน path segments ต่างกัน |
| /settings/payment | GET/POST {promptPayNumber} | JWT; body ใช้ TypeScript interface ไม่ใช่ DTO class ที่มี validators |

## 7. Socket contract ปัจจุบัน

หลักฐาน: `backend/src/events/events.gateway.ts:28` ถึง `:126`; customer consumer `frontend/src/app/order/[token]/page.tsx:62`; KDS consumer `frontend/src/app/(dashboard)/kds/page.tsx:54`

| ทิศทาง / Event | Payload หลัก | Scope ปัจจุบัน |
|---|---|---|
| client→server kitchen:join | {kitchenId:number} | join kitchen:{id}; ack {event:'kitchen:joined',room}; ไม่ตรวจ auth |
| client→server session:join | {sessionId:string} | join session:{id}; ack {event:'session:joined',room}; ไม่ตรวจ auth |
| server→client menu:availability_changed | {menuItemId,isAvailable,name} | broadcast ทุก client |
| server→client kitchen:new_order | {orderId,sessionId,items} | kitchen:{number} |
| server→client kitchen:void_order | {orderItemId,orderId,reason} | kitchen:{number} |
| server→client order:status_changed | order object | session:{raw UUID} ตาม service |
| server→client order:item_status_changed | {orderItemId,orderId,status,...} | session:{raw UUID}; metadata เพิ่มตาม caller |
| server→client table:status_changed | {tableId,status} | broadcast; โดยทั่วไป tableId number แต่ session update อาจ emit prefixed string |
| server→client session:status_changed | {sessionId,status} | session:{raw UUID} |
| server→client session:time_warning | {sessionId,minutesLeft} | session:{raw UUID}; cron ทุกนาที |
| server→client ingredient:low_stock | {ingredientId,name,currentStock,unit,isEmpty} | broadcast ทุก client |
| server→client invoice:new | {invoiceId,netAmount,paymentMethod,tableNumber,createdAt} | broadcast ทุก client; invoiceId raw UUID |

Frontend emit `new-order` (POS/QR) และ `update-order-item` (KDS) แต่ gateway ไม่มี SubscribeMessage สำหรับสองชื่อนี้ REST services เป็นตัว emit เหตุการณ์จริงหลังเขียนข้อมูล; customer ไม่ได้ join session room; KDS ฟัง item status แต่ join เฉพาะ kitchen rooms ขณะที่ gateway ส่ง item status เข้า session room จึงต้องตรวจการ sync KDS หลายจอเพิ่ม

## 8. ID formats ที่ต้องรักษา/ตัดสินใจก่อนแก้

| Entity | Database / internal | HTTP ที่พบ | ความไม่สอดคล้อง |
|---|---|---|---|
| Session | UUID มีขีด | ses_ + hex32 | QR ส่ง ses_ กลับ orders ที่ต้องการ raw; Socket ใช้ raw |
| Table | Int | /tables คืน number; nested session คืน tbl_000001 | updateStatus ใช้ transformed string เป็น Int query |
| Tier | Int | /tiers คืน number; nested session คืน tier_000001 | frontend/types และ response DTO ยังประกาศ number |
| Order / item | UUID | raw UUID | IdPrefix มี ord/oi แต่ services นี้ไม่ได้แปลง |
| Invoice | UUID | inv_ + hex32 | invoice:new ใช้ raw; frontend Invoice.id ประกาศ number (`types/index.ts:128`) |
| User | UUID | /users,/auth raw; invoice.createdBy เป็น usr_ | format ต่างกันตาม endpoint |
| Sequential numbers | Int autoincrement | userNumber/sessionNumber/orderNumber/invoiceNumber | เป็น display field แยก PK; migration ยังขาด |
| QR token | UUID random แยก session PK | /order/[token] → /sessions/qr/:token | ใช้เพียงตอน resolve session; POST order ไม่ตรวจ token |

IdTransformer (`backend/src/common/utils/id-transformer.util.ts:37`) เป็นการจัดรูปแบบ ไม่ใช่ encryption/authorization และ decode ไม่ตรวจว่าค่า prefix เป็นชนิด entity ที่คาดหมาย; malformed input บางชนิด throw Error ธรรมดาซึ่ง HTTP filter จะแปลงเป็น 500

## 9. Workflow ตามโค้ดจริงและช่องว่าง

```mermaid
flowchart TD
  A[Staff login JWT] --> B[POST sessions: table/tier/counts]
  B --> C[Create ACTIVE session + table OCCUPIED]
  C --> D[QR URL /order/token]
  D --> E[GET sessions/qr/token + GET all menu-items]
  E --> F[POST orders with ses_ ID]
  F --> G[F04: raw lookup mismatch ต้องแก้ก่อน workflow ไปต่อ]
  G -. หลังแก้ ID .-> H[Create order/items + emit kitchen:new_order]
  H --> I[KDS PATCH item status]
  I --> J[Emit item status to session room]
  J --> K[F08: customer ไม่ join room]
  C --> L[Cron endTime: EXPIRED + CLEANING]
  L --> M[F11: invoice rejects EXPIRED; F04 อาจทำ table update ล้ม]
  C --> N[Invoice UI คิดราคา + แสดง QR เบอร์โทร]
  N --> O[POST invoices: client totals]
  O --> P[Create invoice + CLOSED session + CLEANING table]
  P --> Q[Staff PATCH table AVAILABLE]
  N -. ช่องว่าง .-> R[ไม่มี payment-confirmed state / webhook flow แยก]
```

เส้นประหลัง F04 แสดง flow ที่ตั้งใจให้เกิด ไม่ใช่ E2E ที่พิสูจน์ว่าผ่านแล้ว การ POST invoice ในปัจจุบันทำให้ปิด session/เปลี่ยนโต๊ะทันที ไม่มีโมเดลสถานะชำระเงินหรือหลักฐาน confirmation ที่แยกจากการออก invoice

## 10. ข้อจำกัดและสิ่งที่ยังไม่ได้ยืนยัน

- ไม่ได้ทดสอบจริงกับ PostgreSQL: migrations on fresh/existing DB, rollback, isolation/locking, duplicate invoices และ stock lost updates
- ไม่ได้รัน HTTP application ที่ต่อ DB, Browser/mobile UI, auth cookie/refresh/reconnect แบบ end-to-end, การชำระเงินกับผู้ให้บริการ หรือแอปธนาคาร
- ไม่ได้ Docker build เพราะ daemon ใช้งานไม่ได้; ไม่ได้รัน CI workflows ซึ่งมีขั้น auto-merge/push/delete branch
- ผล build เป็น Node 25/macOS ไม่ใช่ Node 20/Linux ตาม CI/Docker; ไม่อนุมานว่า container ผ่านตาม
- Probes ใช้ compiled production classes จริง แต่ Prisma/Socket เป็น in-memory doubles และ routing module override JwtGuard เพื่อดู route registration เท่านั้น ไม่ได้ทดสอบ JWT validation/network authorization
- F15 storage probe ใช้จริง Zustand + transpile authStore และ localStorage/document doubles ไม่ใช่ browser cross-tab/XSS/cookie environment
- ไม่ทำ vulnerability audit/CVE lookup และไม่ตีความ npm deprecation เป็นช่องโหว่ที่พิสูจน์แล้ว

## 11. Business decisions ที่ต้องมีคำตอบก่อน implementation

1. ใครจัดการผู้ใช้/role, void, ลดราคา และเปลี่ยนบัญชีรับเงินได้? KITCHEN จำกัดครัวอย่างไร?
2. ใช้ราคาตอนเปิดโต๊ะหรือจ่ายเงิน? VAT/service charge/rounding และจำนวนเด็ก/ผู้ใหญ่ขั้นต่ำคืออะไร?
3. หมดเวลาสั่งแต่ยังไม่ชำระต้องคงโต๊ะสถานะใด? ต่อเวลา/ค่าปรับมีหรือไม่?
4. หนึ่ง session แยกบิล/รับชำระหลายรอบได้หรือไม่? จุดไหนนับว่าปิดยอดแล้ว?
5. Payment confirmation เป็นพนักงานยืนยันเอง หรือ provider/webhook? QR ประเภทใดและผู้รับเงินใดที่ได้รับอนุมัติ?
6. ตัดวัตถุดิบเมื่อสั่ง/เริ่มทำ/เสิร์ฟ และคืนเมื่อ void เงื่อนไขใด? อนุญาตติดลบหรือไม่?
7. รูปแบบ external IDs เดิมต้องรองรับนานเท่าใด รวม QR ที่ออกแล้วและ client เก่า?
8. เป้าหมาย LAN/domain/HTTPS/หลายสาขา และนโยบาย auto-merge/delete branch ที่ต้องการคืออะไร?

## 12. ลำดับงานถัดไปที่เสนอเท่านั้น

1. งาน 01: จัด entrypoint/Jest baseline, ID contract และ migration; รักษา current endpoints พร้อม decode ที่ boundary และทดสอบ test DB แบบไม่ทำลายข้อมูล
2. งาน 02: permission matrix, QR credentials และ Socket authorization; ต้องแก้ P0 ก่อนเปิดผู้ใช้จริง ไม่รอให้ทุกงานเสร็จจึงปิดช่องโหว่
3. งาน 03: tier/time validation, room/reconnect, route naming และ state/void audit
4. งาน 04: backend pricing, expired-unpaid checkout, idempotency/concurrency และ payment settings/QR/confirmation หลังได้ business decisions
5. งาน 05–07: inventory ledger, auth lifecycle, CI/Docker/docs ตาม dependencies และขอบเขตของแต่ละ Prompt

รอบนี้หยุดที่การตรวจและรายงานตาม Prompt 0 เท่านั้น ยังไม่มีการลงมือแก้รายการข้างต้น
