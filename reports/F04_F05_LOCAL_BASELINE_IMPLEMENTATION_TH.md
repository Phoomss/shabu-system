# ผลแก้ F04/F05 และ F16 เฉพาะ local build/start

วันที่: 21 ตุลาคม 2026  
ฐานโค้ด: `c23a6a3`, branch `fix/fix-all-system`  
อ้างอิง: `SYSTEM_AUDIT_FOR_GPT_TH.md` และผล Prompt 0

## ผลลัพธ์

แก้การสั่ง/อ่านออเดอร์ด้วย session ID จาก API ได้ทั้งแบบเดิมมี prefix และ raw UUID ปิดหรือหมดเวลา session แล้วอัปเดตโต๊ะด้วย integer PK ภายใน transaction เดียว ส่ง success events หลัง commit เท่านั้น เพิ่ม migration สำหรับเลขแสดงผลทั้ง 4 คอลัมน์ และทำ backend/frontend clean install → generate → migration test DB → build/start ได้จริง

Regression tests ผ่าน: backend unit 30 ข้อ, PostgreSQL/HTTP/Socket integration 6 ข้อ, frontend ID normalization 3 ข้อ รวม 39 ข้อเฉพาะงานนี้ Full legacy test/lint ยังไม่ผ่านตามรายละเอียดด้านล่าง จึงไม่ได้สรุปว่าทั้งระบบพร้อม production

ไม่มี deploy/push/merge/seed/reset/drop/truncate ฐานข้อมูลเดิม ไม่แก้ migration เก่า ไม่แก้ lockfile หรืออัปเกรด dependencies และไม่เปลี่ยน workflow ราคา/สิทธิ์/stock/payment/CI นอกขอบเขต

## สิ่งที่แก้และเหตุผล

| ส่วน/ไฟล์ | การแก้ |
|---|---|
| `backend/src/common/utils/id-transformer.util.ts` | ตรวจ UUID/int แบบเต็มค่า ตรวจ prefix ตาม entity ปฏิเสธ display number, suffix, ค่าติดลบ/ทศนิยม/out-of-range ด้วย BadRequestException (400) |
| `backend/src/orders/orders.service.ts` | decode session/order/item/menu aliases ก่อน query; filter session ที่ไม่มีจริงตอบ 404; ไม่ใช้ prefixed ID กับ DB |
| `backend/src/sessions/sessions.service.ts` | ใช้ raw record ใน transaction สำหรับ session+table; emit หลัง commit; ตัด event expiry ซ้ำ; ใช้ node:crypto randomUUID ซึ่งยังเป็น UUID v4 เพื่อหลีกเลี่ยง uuid 13 ESM ใน CommonJS/Jest baseline |
| `backend/src/invoices/invoices.service.ts` | ระบุ expected prefix ของ invoice/session เพื่อไม่คืน 500 หรือยอมใช้ ID ของคนละ entity; ไม่เปลี่ยนราคา/ชำระเงิน |
| `backend/src/events/events.gateway.ts` | session:join รับ raw/prefixed แล้ว join room เดียวกัน; invalid ID เป็น WsException 400; เติม data.room ให้ event session:joined ส่ง payload จริงตาม Nest Socket adapter |
| session/invoice response DTOs | แก้ type ของ wire-prefixed integer fields ให้เป็น string ตาม response ที่มีอยู่จริง ไม่เปลี่ยน wire response |
| `frontend/src/lib/id-contract.ts` | ตัวแปลง boundary ส่วนกลางให้ application IDs เป็น UUID/Int; แปลงเฉพาะชื่อ field ของ ID และ prefixes ที่รู้จัก ไม่แปลง QR token/ชื่อเมนู/display number |
| `frontend/src/lib/api.ts`, `socket.ts` | ใช้ normalization เดียวกันกับ staff/public REST responses และ Socket payload ก่อนส่งให้ consumer |
| `frontend/src/app/order/[token]/page.tsx` | โหลดประวัติครั้งแรกด้วย ID ที่ resolve ได้โดยตรง ไม่รอ setState; ส่วน room/reconnect lifecycle ทั้งหมดของ F08 ยังไม่ได้ทำ |
| `frontend/src/types/index.ts` | Invoice.id และ invoice:new.invoiceId เป็น string UUID ไม่ใช่ number |
| `backend/tsconfig.build.json`, `register-paths.cjs`, package.json | build เฉพาะ src, entrypoint dist/main.js และ runtime src/* alias; เพิ่มคำสั่ง generate/migrate/targeted tests; map Jest src/* |
| `backend/Dockerfile` | ใช้ npm ci และ copy Prisma config/runtime alias loader ที่จำเป็นต่อ build/start; ไม่เปลี่ยน CI หรือ compose |
| `frontend/package.json`, `.env.example`, `.gitignore`; `backend/.env.example` | frontend dev/start port 3001 ให้ตรง local CORS/API port 3000; ตัวอย่าง local config; ไม่สร้างไฟล์ .env จริงให้ทับของผู้ใช้ |
| migration ใหม่ | `backend/prisma/migrations/20261021070000_add_display_numbers/migration.sql` |
| regression/supporting tests | unit specs 4 ไฟล์, `backend/test/id-contract.e2e-spec.ts`, test config, migration verifier, start smoke script และ `frontend/test/id-contract.test.mjs` |

ไฟล์รายงาน/หลักฐาน Prompt 0 ที่ untracked อยู่ก่อนเริ่มยังคงอยู่ ไม่ได้ลบหรือเขียนทับ

## ID contract และ compatibility

**Canonical identity ภายใน application = UUID ที่มีขีด หรือ positive PostgreSQL Int ตาม entity** Backend ไม่ใช้ serialization/display IDs query DB; frontend แปลง wire aliases ที่ response boundary ก่อนเก็บ state/เปรียบเทียบ/ส่งคำขอ และ Socket ใช้หลักเดียวกัน

| Entity | Canonical/internal | รูปแบบ wire เดิมที่คงไว้ / การรับ alias |
|---|---|---|
| Session | raw UUID | HTTP sessions/invoices ยังคง `ses_` + hex32; sessions/orders/invoices และ Socket session:join รับ raw หรือ ses_ |
| Table/Tier | integer | list endpoints ยังคง number; nested session/invoice responses ยังคง tbl_/tier_ strings; frontend normalize เป็น number; create-session request ยังคง integers ตาม contract เดิม |
| Order/OrderItem | raw UUID | HTTP/Socket output ยังคง raw; order/item methods รับ ord_/oi_ aliases เพิ่มโดยตรวจ entity |
| MenuItem | raw UUID | output ยังคง raw; order input รับ menu_ alias เพิ่ม |
| Invoice | raw UUID | HTTP output ยังคง inv_; invoice lookup รับ raw/inv_; Socket invoice:new ยังคง raw string |
| User | raw UUID | /auth,/users ยังคง raw; invoice.createdBy ยังคง usr_; frontend แปลงเป็น raw |
| QR token | UUID แยก credential | ไม่แปลงจาก display ID และไม่ใช้ sessionNumber แทน |
| userNumber/sessionNumber/orderNumber/invoiceNumber | เลขแสดงผลที่ไม่ซ้ำ | ไม่ใช่ PK ไม่ใช้ resolve query หรือ join room และไม่รับ `SES-000001` เป็น session UUID |

นี่เป็น compatibility layer สำหรับ API ปัจจุบัน ไม่ใช่การเปลี่ยน output ให้ client เดิมพัง การมีหลาย wire aliases ถูกจำกัดไว้ใน serializers/normalizers; consumers ใช้ canonical identity เดียว ไม่ต้อง decode กระจัดกระจายตามหน้า UI

Socket room ภายในยังเป็น `session:{raw-uuid}` เหมือนเดิม จึงส่ง event ให้ raw/prefixed join เข้า room เดียวกัน ไม่มีการ emit ซ้ำสอง rooms เพื่อชดเชย ID ผิดรูปแบบ `session:joined` ส่ง `{room}` เป็น event payload ได้จริง โดย return object ของ handler ยังคงมี event/room เดิมและเพิ่ม data

การเปลี่ยน behavior ที่ตั้งใจ: `GET /orders?sessionId=` ที่ malformed ตอบ 400; session ID ถูกต้องแต่ไม่มีจริงตอบ 404 แทน empty list ไม่เปลี่ยน `GET /orders` แบบไม่ส่ง filter ซึ่งยังอยู่ใน F02 นอกขอบเขตงานนี้

หากอนาคตต้องการ wire format เดียวทุก endpoint ควรทำ API version/transition แยกต่างหาก พร้อมแจ้ง consumers ก่อนยกเลิก aliases รอบนี้ยังไม่ยกเลิก raw หรือ prefixed UUID ที่รองรับ

## Migration, backfill และ recovery

เพิ่มเฉพาะ migration ใหม่เป็น transaction เดียว:

1. เพิ่ม sequence ที่แต่ละคอลัมน์เป็นเจ้าของ และคอลัมน์ integer แบบ nullable ชั่วคราว
2. ตั้ง DEFAULT nextval แล้ว backfill แถวเดิมด้วย nextval
3. ตั้ง NOT NULL และ unique index ให้ตรง schema.prisma ทั้ง User.userNumber, Session.sessionNumber, Order.orderNumber, Invoice.invoiceNumber
4. ไม่แก้ UUID PK, FK, จำนวนแถว หรือข้อมูลเดิมอื่นๆ Sequence ทำให้ insert ใหม่ต่อจากเลขเดิมโดยอัตโนมัติ

เลขที่ backfill รับประกัน uniqueness ไม่ได้สื่อ chronology; PostgreSQL sequences มีช่องว่างได้แม้ transaction rollback การแสดงผลห้ามใช้สมมติฐานว่าเลขต่อเนื่องไร้ช่องว่าง

ทดสอบบน PostgreSQL 15 จริงทั้ง empty DB และ DB ที่ deploy 4 migrations เก่าแล้วใส่ 2 แถวต่อ entity ก่อน upgrade ตรวจ snapshot ก่อน/หลังเท่ากันเมื่อไม่นับคอลัมน์ใหม่, NOT NULL จริง, duplicate update ได้ SQLSTATE 23505, sequence สูงกว่า max และ Prisma diff เป็นศูนย์ทั้งสองฐาน deploy ซ้ำเป็น no-op

Recovery strategy:

- หาก application rollback ให้คงคอลัมน์/sequence ใหม่ไว้ได้ เพราะเป็นการเพิ่มข้อมูลและมี defaults; ไม่ drop คอลัมน์เพื่อลบเลขที่ออกไปแล้ว
- หาก migration ล้มเหลว transaction จะ rollback DDL/data ชุดนี้ ตรวจสาเหตุและ `_prisma_migrations` ก่อนแก้ และใช้ migrate resolve เฉพาะเมื่อยืนยันสถานะ rollback แล้ว ไม่ mark applied เพื่อข้าม schema ที่ยังไม่ตรง
- หากฐานเดิมเคย db push จนมีคอลัมน์/sequence เหล่านี้อยู่แล้ว ให้ตรวจ drift และทำแผน reconcile เฉพาะฐานนั้นก่อน apply; migration นี้ตั้งใจ fail เมื่อชน object แทน overwrite เลขเดิม
- ก่อนใช้กับข้อมูลจริงในอนาคตต้องมี backup ที่ทดสอบ restore ไปฐานแยกได้ และประเมิน table lock/backfill ตามขนาดข้อมูล รอบนี้ไม่ได้ apply กับข้อมูลจริงหรือทำ destructive down migration

## ผลคำสั่งจริง

Environment: macOS, Node 25.9.0, npm 11.12.1; PostgreSQL container `postgres:15-alpine`, localhost:55432 ข้อมูลจำลองเท่านั้น ไม่มี volume ของร้าน

หลักฐานทั้งหมดอยู่ใน [implementation01-evidence](implementation01-evidence/)

| คำสั่ง | Exit | ผล |
|---|---:|---|
| backend npm ci --offline --no-audit --no-fund + cache ที่ดาวน์โหลดไว้ | 0 | PASS clean install 870 packages จาก lockfile |
| frontend npm ci --offline --no-audit --no-fund + cache ที่ดาวน์โหลดไว้ | 0 | PASS clean install 710 packages จาก lockfile |
| backend npm run prisma:generate | 0 | PASS Prisma Client 7.4.2 หลังอนุญาตให้ใช้ engine cache; รอบ sandbox ก่อนหน้า exit 1 เพราะ EPERM |
| backend npm run test:migrations | 0 | PASS fresh/populated deploy, data preservation, constraints, sequence, schema diff=0 และ redeploy |
| backend npm run build | 0 | PASS compile dist/main.js |
| frontend npm run build พร้อม NEXT_PUBLIC_API_URL/SOCKET_URL=localhost:3000 | 0 | PASS หลังอนุญาต network เพื่อ Google Fonts; มี middleware deprecation warning เดิม |
| backend npm run test:ids | 0 | PASS 4 suites / 30 tests |
| frontend npm run test:ids | 0 | PASS 3 tests |
| backend npm run test:ids:e2e + isolated test URL | 0 | PASS 6 tests ใช้ migrated PostgreSQL, JWT login, HTTP และ Socket จริง |
| backend npm run test:local-start + isolated test URL | 0 | PASS npm start:prod → API/query DB + Swagger 200; frontend npm start → /login และ /order/[token] 200; หยุด child processes แล้ว |
| scoped lint ของ ID utility/new regression TS และ frontend helper/test | 0 | PASS ไม่เหลือ lint errors/warnings ในกลุ่มไฟล์ที่ตรวจเฉพาะ |
| backend full npm test -- --runInBand | 1 | FAIL baseline: 25 legacy suites fail, 4 new suites pass; 24 legacy tests fail, 30 new tests pass; ส่วนใหญ่ missing DI mocks และ typo kitechens imports |
| backend full ESLint โดยไม่ --fix | 1 | FAIL 391 problems: 366 errors + 25 warnings ในโค้ดเดิม/ไฟล์เดิม; ไม่แก้ทั่ว repo นอก scope |
| frontend full npm run lint | 1 | FAIL 135 problems: 60 errors + 75 warnings เช่นเดียวกับ baseline; helper/test ใหม่ lint ผ่าน |
| git diff --check | 0 | PASS whitespace และตรวจ lockfile/migrations เดิมไม่เปลี่ยน |
| Docker image build / browser interaction / Node 20 | — | NOT RUN; ไม่อ้างว่าผ่านจากผล local Node 25 |

ระหว่างพัฒนาพบ test failures เพิ่มเติมที่แก้ใน scope: Jest อ่าน uuid 13 ESM ไม่ได้ (เปลี่ยนเป็น built-in UUID v4) และ Socket join เดิมไม่มี data payload จึงรอ ack/event ไม่สำเร็จ (เพิ่ม payload และทดสอบ event จริง) ผล PASS ในตารางเป็นผลหลังแก้และ clean install แล้ว

## Acceptance ที่ยืนยันได้

| เงื่อนไข | หลักฐาน |
|---|---|
| ใช้ session ID ที่ API ส่งจริงสั่ง/อ่านประวัติได้ | E2E เปิดโต๊ะ → GET QR → POST order/GET history ด้วย ses_ และ raw → GET order ด้วย ord_ |
| malformed/nonexistent ไม่กลายเป็น 500 | E2E 400/404 ของ sessions/orders/invoices พร้อม wrong-entity aliases; unit ปฏิเสธ display numbers และ malformed integer IDs |
| ปิด/หมดเวลาแล้ว session+table สอดคล้อง | E2E close/cron และจำลอง session write ล้มเหลวด้วย test-only trigger หลัง table update แล้วตรวจ rollback + ไม่มี success event |
| migration บนฐานว่าง/มีข้อมูลรักษาข้อมูลเดิม | test:migrations + schema diff exit 0 ทั้งสองฐาน พร้อม constraint checks จริง |
| clean install/build/start | clean-install/build logs และ local-start-smoke.log |

## วิธีทำซ้ำบน local/test

ใช้เฉพาะ test container ใหม่ที่สร้างไว้: `shabu-f04-f05-test-20261021` บน `127.0.0.1:55432` อย่านำคำสั่งทดสอบไปชี้ DB ร้านจริง

```sh
# backend directory; ติดตั้งตาม lockfile ไม่ upgrade
npm ci
npm run prisma:generate

# สร้าง DB ทดสอบใหม่สองฐานและ apply migrations; ไม่ลบฐานเก่า
ALLOW_SHABU_TEST_DB=1 \
SHABU_TEST_ADMIN_URL=postgresql://shabu_test:shabu_test_local@127.0.0.1:55432/shabu_test \
npm run test:migrations

npm run test:ids
npm run build
```

อ่าน URL ของฐาน empty ล่าสุดจาก `reports/implementation01-evidence/test-databases.json` แล้วตั้ง `DATABASE_URL` เป็น URL นั้น (ไฟล์มีเฉพาะ credentials จำลอง) ตั้ง `ALLOW_SHABU_TEST_DB=1`, `JWT_SECRET` และ `JWT_REFRESH_SECRET` สำหรับทดสอบ แล้วรัน `npm run test:ids:e2e` ส่วน `npm run test:local-start` จะเริ่มและหยุดสองแอปให้เองหลัง build frontend แล้ว

```sh
# frontend directory; ใช้ค่า local API ที่ตรงกับ backend
npm ci
npm run test:ids
NEXT_PUBLIC_API_URL=http://localhost:3000 \
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000 npm run build
npm run start  # port 3001; backend compiled start ใช้ npm run start:prod ที่ port 3000
```

ฐานทดสอบและ container ยังเก็บไว้เพื่อตรวจย้อนหลัง ไม่มีการลบข้อมูลเพื่อให้ test ผ่าน backend/frontend ที่ smoke test เปิดถูกหยุดแล้ว Docker Desktop/test PostgreSQL ยังทำงานอยู่

## ข้อจำกัดและงานที่ยังอยู่นอก scope

- การปิด session เป็น atomic แล้ว แต่ยังไม่แก้ race เปิดโต๊ะ/ออกใบเสร็จซ้ำ (F10) หรือกติกา expired-unpaid/checkout (F11)
- ไม่แก้ authorization/API public/Socket security (F01/F02/F07), tier/time constraints (F06), payment pricing/QR/settings (F03/F12), void transitions (F13), stock/auth lifecycle และ CI
- QR ประวัติครั้งแรกใช้ ID ที่ถูกต้องแล้ว แต่การ join/rejoin/listener lifecycle ทั้งหมดของ F08 ยังเป็นงานแยก; รอบนี้ Socket integration ทดสอบ gateway protocol ไม่ใช่ browser QR lifecycle
- Full legacy unit/lint ยังไม่ green ไม่ซ่อนหรือลบ tests เดิมเพื่อให้รายงานดูผ่าน
- รูปแบบ wire เดิมยังคงไว้เพื่อ compatibility; ลูกค้าที่เรียก API ภายนอกควรถือ ID เป็น opaque และใช้ aliases ตามตาราง ไม่แยกเลข display มา query
- Local tests ไม่ใช่ผล Docker/Node 20/mobile browser/production deployment acceptance
