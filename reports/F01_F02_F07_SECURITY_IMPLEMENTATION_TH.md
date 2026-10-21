# ผลแก้ F01/F02/F07 — REST/Socket authorization และ customer credential

วันที่: 21 ตุลาคม 2026  
ฐานโค้ดที่ตรวจ: `e16dd3b`, branch `fix/fix-all-system` (working tree สะอาดก่อนเริ่ม)

## ผลลัพธ์และสถานะ approval

เพิ่ม server-side authentication/permissions ให้ employee APIs แยก customer APIs พร้อม signed credential เฉพาะ session ป้องกัน cross-session/kitchen access และจำกัด Socket events ตามสิทธิ์จริงทั้งตอนเชื่อมต่อ/join และก่อนส่งข้อมูล

**Permission matrix ยังรอการอนุมัติ** ตามเงื่อนไขในคำขอ จึงไม่มีการกำหนดสิทธิ์ให้ OWNER/MANAGER/STAFF/KITCHEN หรือ role อื่นโดยอัตโนมัติ ค่าเริ่มต้น `STAFF_PERMISSION_GRANTS={}` และ `KITCHEN_USER_ASSIGNMENTS={}` ทำให้ทุก role ได้ 403 ในงานพนักงานที่ยังไม่กำหนดสิทธิ์ รวม OWNER ส่วน login/refresh/logout/me และ customer QR flow ยังคงมีเส้นทางใช้งานที่ยืนยันตัวตนถูกต้อง

ตารางเสนอสำหรับรีวิว: [SECURITY_PERMISSION_MATRIX_TH.md](SECURITY_PERMISSION_MATRIX_TH.md) ได้ส่งคำถามให้รีวิวระหว่างทำงานแล้ว ยังไม่ได้ถือว่าการไม่ตอบเป็นการอนุมัติ การทดสอบ positive ใช้ grants/assignments **เฉพาะใน test configuration** ไม่ได้เขียน grants เหล่านั้นลง `.env` หรือกำหนดเป็น production defaults

Security tests ผ่าน 40 ข้อ (unit policy 8 + real REST/Socket integration 29 + frontend client 3) และ ID regression เดิมผ่านอีก 39 ข้อ ทั้งสองแอป build/start ผ่านจริง Full legacy unit suite ยังล้มเหลวตามรายละเอียดด้านล่าง

ไม่มี deploy/push/merge ไม่มีการเปลี่ยน schema/migrations/lockfiles หรือติดตั้ง dependency ใหม่ ไม่ใช้ฐานข้อมูลจริง

## ข้อค้นพบที่ยืนยันก่อนแก้

| Issue | หลักฐานในฐานโค้ดก่อนแก้ | ผลแก้ |
|---|---|---|
| F01 | RoleController ไม่มี guard; employee controllers ตรวจแค่ JWT; UI roles ไม่ถูกบังคับฝั่ง server | Global AccessGuard ตรวจ JWT แล้ว permission/action; resource/action ที่ไม่ระบุหรือไม่ grant ถูกปฏิเสธ |
| F02 | GET/POST /orders เป็น public; sessionId ใช้เลือกโต๊ะโดยไม่ตรวจ QR credential | /orders เป็น staff-only; customer ใช้ /customer/orders และ session จาก signed credential เท่านั้น |
| F07 | Socket handshake/join ไม่ตรวจ credential; invoice/stock broadcast ทุก client | Middleware ตรวจ staff/customer JWT ก่อน connect; join ตรวจ scope; event delivery ตรวจสิทธิ์ใหม่และ financial/stock ส่งเฉพาะ staff ที่ได้รับอนุญาต |

อ่าน role/user/auth/strategies/guards, controllers, orders/DTOs, QR flow, gateway, bootstrap CORS, frontend staff/QR/KDS consumers และ Swagger แล้ว Seed มี 4 ชื่อ role ที่ใช้เป็นต้นแบบ แต่ Role.name ใน schema เป็น string จึงรองรับ role อื่นโดยไม่มี implicit grants ไม่ได้อ่านฐานข้อมูลจริงเพื่อสำรวจผู้ใช้หรือ secrets

## Endpoint/action matrix ที่ implementation ใช้จริง

GET/HEAD ใช้ `.read`; POST/PATCH/DELETE ใช้ `.write` ของ resource ยกเว้น actions เฉพาะในตาราง ทุก employee permission ต้องอยู่ใน server config ของชื่อ role ที่อ่านจาก DB ปัจจุบัน ไม่อ่าน role/permission ที่ client อ้างใน body หรือ JWT claims

| Endpoint/action | Permission / credential | ขอบเขต |
|---|---|---|
| POST /auth/login | Public + username/password validation | ไม่คืนสิทธิ์จาก client; ผู้ใช้ต้อง active |
| POST /auth/refresh | Public route + JwtRefreshGuard/cookie | ตรวจ signature/expiry/hash/active user ตาม flow เดิม; จำกัด HS256 และ token kind |
| POST /auth/logout, GET /auth/me | authenticated `auth.self` | ทุกผู้ใช้ active เข้าถึงข้อมูลตนเองได้; ไม่ต้องมี business grant |
| /users CRUD | users.read / users.write | จัดการบัญชี/role assignment ต้องได้รับ grant ชัดเจน |
| /role CRUD | roles.read / roles.write | ไม่มี anonymous role management อีกต่อไป |
| /tables CRUD/status | tables.read / tables.write | ไม่มี implicit STAFF table write |
| /sessions list/detail/open/status | sessions.read / sessions.write | staff APIs; ยังคง ID contract จาก F04 |
| GET /sessions/qr/:token | QR capability exchange | URL เดิม; ตรวจ active/endTime; คืน minimal session + signed customer credential |
| /menu-items รวม by-tier/availability | menu.read / menu.write | เดิม GET all public เปลี่ยนเป็น employee-only |
| /tiers, /categories CRUD | tiers.read/write, categories.read/write | ไม่เปิดข้อมูลแพ็กเกจ/ราคาผ่าน public employee API |
| /kitchens CRUD | kitchens.read / kitchens.write | อ่านรายชื่อได้ตาม grant; การเข้ารายการครัวยังต้องมี assignment แยก |
| /ingredients CRUD/stock | ingredients.read / ingredients.write | รวมสิทธิ์รับ low-stock event ตาม read grant |
| GET/POST /orders, GET :id, PATCH :id/status | orders.read / orders.write | staff-wide order actions ตาม explicit grant |
| GET /orders/kitchen/:kitchenId | kitchen.orders.read + assignment | ทุก role ต้องได้รับครัวนั้นจริง ไม่มี OWNER bypass |
| PATCH /orders/items/:itemId/status | kitchen.orders.write + assignment | อ่าน kitchenId ของ item จาก DB; ห้าม VOIDED ผ่านทางลัดนี้ |
| POST /orders/items/:itemId/void | orders.void | actor จาก JWT; ต้องใช้ flow ที่สร้าง VoidLog |
| GET /orders/void-logs | void-logs.read | ย้าย static route ก่อน :id เพื่อให้ตรวจ permission ที่ถูกตัว |
| /invoices list/detail/create/revenue | invoices.read / invoices.write | ลูกค้าใช้ customer token เรียกไม่ได้ |
| GET/POST /settings/payment | payment-settings.read / payment-settings.write | เพิ่ม DTO validation; ไม่เปิดสิทธิ์ให้ MANAGER เอง |
| GET /customer/orders | Customer bearer | อ่านเฉพาะ session ใน credential; optional sessionId ต้องตรงกัน |
| POST /customer/orders | Customer bearer | server ใช้ session ใน credential; body sessionId เป็นเพียง assertion ที่ต้องตรงกัน |
| GET /customer/menu-items | Customer bearer | อ่าน minimal menu fields ของ tier ใน session; ไม่ส่งราคา/stock/recipes |

หาก endpoint ใหม่ไม่มี permission/resource metadata จะไม่เปิดให้ผู้ใช้ที่ login แล้วโดยอัตโนมัติ Public exemptions มีเฉพาะ login, refresh (ยังมี refresh guard) และ legacy QR exchange

## Server grants และ assignment

`PermissionPolicy` อ่าน JSON config ตอนเริ่ม process และตรวจชื่อ permissions/ชนิดข้อมูล Reject wildcard/ชื่อผิด/assignment ที่ไม่ใช่ UUID → positive integer IDs หาก config ไม่ถูกต้องจะไม่เงียบแล้วเปิดสิทธิ์แทน

```text
STAFF_PERMISSION_GRANTS={}
KITCHEN_USER_ASSIGNMENTS={}
```

หลังอนุมัติแล้ว operator สามารถตั้ง JSON ตามรายการที่อนุมัติ เช่นรูปแบบ `{"APPROVED_ROLE":["orders.read"]}` และ `{"raw-user-uuid":[1,2]}` โดยใช้ UUID/Int จริงของระบบ ไม่ใช้ display numbers ตัวอย่าง UUID ในข้อความนี้เป็น placeholder ที่ต้องแทนค่าจริง ไม่ใช่ config ที่รันได้

ทุก role ที่อ่าน/แก้รายการครัวหรือ join room ครัวต้องมีทั้ง kitchen.orders permission และ user assignment ของครัวนั้น การเปลี่ยน config ต้อง restart backend; ไม่มี endpoint ให้ client แก้ server grants เอง `/auth/me` คืน permissions/kitchenIds สำหรับผู้ใช้ตนเองเพื่อให้ KDS เลือกเฉพาะครัวที่รับผิดชอบ

Compose เพิ่มเพียงการส่งผ่าน CORS_ORIGINS/STAFF_PERMISSION_GRANTS/KITCHEN_USER_ASSIGNMENTS/CUSTOMER_JWT_SECRET ไม่เปิด grants เริ่มต้น ไม่รัน stack/deploy และไม่ได้แก้ CI

## Customer credential และข้อมูลที่ส่งกลับ

- QR token เดิมใน `/order/[token]` และ DB ยังใช้ได้สำหรับ session ที่ active และยังไม่หมดเวลา ไม่บังคับลูกค้า login พนักงานหรือออก QR ใหม่
- GET `/sessions/qr/:token` ใช้ QR ที่ครอบครองจริงแลก JWT ซึ่งมี `kind=customer`, `sub=session UUID`, `qrBinding=SHA256(qrToken)`, `aud=shabu-customer`, `iss=shabu-api`, HS256 และ `exp` ไม่เกิน 15 นาทีหรือเวลาทานที่เหลือ
- ใช้ signing domain แยกจาก staff/refresh: ตั้ง CUSTOMER_JWT_SECRET แยกได้ หรือ derive ด้วย HMAC-SHA256 จาก JWT_SECRET และ fixed customer context; reject การตั้ง customer key ซ้ำกับ staff/refresh และ staff key ซ้ำ refresh key
- ปฏิเสธการ start เมื่อใช้ signing keys ตัวอย่างที่ส่งมากับ config (`your_secret_key`, `your_refresh_secret_key` หรือ replace-with-...) โดยไม่ log ค่า key ต้อง provision private keys จริงก่อน start
- ตรวจ signature/algorithm/audience/issuer/kind/expiry และค้น DB ตรวจ QR binding/status/endTime ทุก customer HTTP request และทุก Socket join/delivery การเปลี่ยน sessionId ใน body/query ไม่เปลี่ยน scope
- Customer token ใช้กับ employee APIs ไม่ได้ และ staff access token ใช้แทน customer token ไม่ได้ มี tests ทั้งสองทิศทาง
- QR exchange คืนเพียง id/status/startTime/endTime/table(id,number)/tier(id,name)/credential/expiresAt ไม่มีราคา จำนวนคน ข้อมูลพนักงาน QR token เดิม หรือ invoice data และตั้ง Cache-Control:no-store
- Customer orders/events ใช้ allowlist projection ไม่ forward Prisma includes ทั้งก้อน แม้อนาคต order object เพิ่ม invoice/user fields ก็ไม่ส่งให้ลูกค้า
- Customer token อยู่ใน memory ของหน้า QR ใช้ Axios instance/Socket แยกเฉพาะหน้า ไม่ลง localStorage/cookie ไม่แนบ staff refresh cookie ไม่ใช้ staff refresh/redirect-to-login interceptor
- หน้า QR ต่อ credential ล่วงหน้าเมื่อเหมาะสม ตรวจใหม่เมื่อ reconnect และแสดงข้อความติดต่อพนักงานเมื่อหมดสิทธิ์แทน redirect ไป staff login

การครอบครอง QR ยังหมายถึงสิทธิ์ของโต๊ะนั้นตามการออกแบบ QR แบบแชร์โต๊ะ JWT ไม่ได้ทำให้ QR ที่ถูกคัดลอกแยกผู้ถือรายบุคคล การปิด/หมดเวลา session หรือ rotate QR token จะเพิกถอน customer credential ที่เกี่ยวข้อง

## Socket decisions

| จุดตรวจ | พฤติกรรม |
|---|---|
| Handshake | รับ `auth.accessToken` สำหรับ staff หรือ `auth.customerToken` สำหรับ customer เพียงชนิดเดียว; anonymous/forged/mixed credentials ไม่ connect |
| Staff identity | verify HS256/expiry/kind แล้วอ่าน active user + role ล่าสุดจาก DB; ไม่เชื่อ role จาก JWT |
| session:join | customer เข้าได้เฉพาะ session ของตน; staff ต้อง sessions.read; raw/prefixed IDs ยัง resolve room raw UUID เดียวกัน |
| kitchen:join | ต้องเป็น staff, kitchen.orders.read และ explicit kitchen assignment; customer ถูกปฏิเสธ |
| Rejoin/reconnect | handshake ใหม่ตรวจใหม่; join ทุกครั้ง revalidate จาก DB ไม่ใช้ principal เก่าอย่างเดียว |
| อายุ connection | ตัด connection เมื่อ JWT หมดอายุ แม้ไม่มี packet ใหม่ |
| invoice:new | room staff:invoices; ก่อนส่งตรวจ role/active/expiry/permission อีกครั้ง |
| ingredient:low_stock | room staff:stock; ตรวจ ingredients.read ใหม่ก่อนส่ง |
| table:status_changed | ส่งให้ staff ที่มี tables.read เท่านั้น |
| Session order/item/status/time events | room เฉพาะ session + ตรวจ scope/active credential; customer ได้ allowlisted payload |
| Menu availability | ส่งเฉพาะ authenticated recipients ที่ยังใช้สิทธิ์ได้; เป็นเพียง menu id/name/availability ไม่มี stock/financial data |

Rooms staff:invoices/staff:stock ไม่ได้มี client join handler จึงไม่สามารถส่งชื่อ room แล้วสมัครรับเอง เมื่อ DB validation/delivery ล้มเหลวจะไม่ fallback เป็น unfiltered broadcast ผู้ใช้ inactive/credential ไม่ valid ถูก disconnect ก่อนส่งข้อมูล

Frontend staff singleton ส่ง access token ล่าสุดผ่าน handshake callback และ recovery ใช้ staff auth flow; customer ใช้ connection แยก ไม่มีการยืม staff identity ปิด staff socket เมื่อ login/logout เปลี่ยน state และกรองครัว KDS จาก `/auth/me.kitchenIds`

## CORS / Swagger / compatibility

- HTTP และ Socket ใช้ CORS_ORIGINS เป็น exact HTTP(S) allowlist ค่า local เริ่มต้น localhost:3001 และ 127.0.0.1:3001 ไม่มี wildcard
- Browser HTTP origin ที่ไม่อนุญาตไม่ได้ Access-Control-Allow-Origin; ไม่อ้างว่า CORS เป็น authentication หรือว่า HTTP จะได้ 403 ทุกกรณี Socket handshake origin ที่ไม่อนุญาตถูกปฏิเสธก่อน connect
- Non-browser requests ที่ไม่มี Origin ยังต้องส่ง credential และผ่าน authorization เหมือนเดิม
- ต้องตั้ง actual LAN/domain origins และ frontend API/Socket URLs สำหรับเครื่องลูกค้าจริง ไม่ใช้ localhost ของโทรศัพท์
- Swagger เพิ่ม Customer bearer แยก JWT, แสดง 401/403 ของ employee/customer routes และใช้ CustomerSessionResponse ที่ไม่มี finance/user fields
- **Breaking security changes ที่ตั้งใจ:** old anonymous `/orders` และ `/menu-items` ไม่เปิดอีกต่อไป Client customer รุ่นเก่าต้อง reload bundle ที่เปลี่ยนไปใช้ `/customer/*` + credential แม้ QR URL เดิมยังใช้ได้ จึงต้องอัปเดต backend/frontend คู่กันเมื่อจะนำไปใช้จริงภายหลัง
- ID serialization/PK/display numbers จาก F04 ไม่เปลี่ยน; signed credentials ไม่ใช้เลขแสดงผลหรือ sessionId เป็นหลักฐานตัวตน

## ผลทดสอบจริง / exit codes

Environment: Node 25.9.0, npm 11.12.1, PostgreSQL 15 บน isolated local container:55432 ฐาน `shabu_security_1792565210231` เป็นฐานใหม่ที่สร้างและ migrate สำหรับงานนี้ ไม่ใช้ DB จริง

| คำสั่ง/การตรวจ | Exit | ผล / หลักฐาน |
|---|---:|---|
| npm run test:security:db | 0 | สร้าง DB ใหม่ + migrate; [test-db-setup.log](security-evidence/test-db-setup.log) |
| backend npm run test:security | 0 | PASS 8 policy tests; [unit.log](security-evidence/unit.log) |
| backend npm run test:security:e2e | 0 | PASS 29 real HTTP/JWT/PostgreSQL/Socket tests; [integration.log](security-evidence/integration.log) |
| frontend npm run test:security | 0 | PASS 3 client isolation/reconnect tests; [frontend-unit.log](security-evidence/frontend-unit.log) |
| backend npm run test:ids | 0 | PASS 30 ID regressions; [id-unit.log](security-evidence/id-unit.log) |
| backend npm run test:ids:e2e | 0 | PASS 6 ID/atomic close/cron/rollback/Socket regressions ด้วย auth contract ใหม่; [id-integration.log](security-evidence/id-integration.log) |
| frontend npm run test:ids | 0 | PASS 3 ID normalization tests; [frontend-id-unit.log](security-evidence/frontend-id-unit.log) |
| backend npm run build | 0 | PASS; [backend-build.log](security-evidence/backend-build.log) |
| frontend npm run build | 0 | PASS; [frontend-build.log](security-evidence/frontend-build.log) |
| scoped backend/frontend ESLint ไม่ --fix | 0 | PASS security/customer/gateway/new tests และ frontend API/socket/QR/client tests; [backend](security-evidence/new-backend-lint.log), [frontend](security-evidence/frontend-scoped-lint.log) |
| npm run test:local-start | 0 | PASS compiled backend/frontend start, Swagger 200, anonymous employee API 401, DB-backed invalid login 401, frontend routes 200; [start-smoke.log](security-evidence/start-smoke.log) |
| docker compose config --quiet | 0 | PASS syntax/config validation เท่านั้น ไม่มี up/deploy; [compose-validation.log](security-evidence/compose-validation.log) |
| backend full npm test -- --runInBand | 1 | FAIL legacy baseline: 25 suites fail, 5 pass; 24 tests fail, 38 pass; legacy DI mocks/typo imports ไม่ได้ลบหรือ skip เพื่อให้ผ่าน; [full-unit-baseline.log](security-evidence/full-unit-baseline.log) |
| git diff --check + invariant checks | 0 | PASS lockfiles/schema/migrations เดิมไม่เปลี่ยน |

รอบแรกใน sandbox เชื่อม localhost ถูกบล็อก EPERM ก่อน setup tests ไม่ใช่ผล auth behavior จึงรันซ้ำด้วยสิทธิ์เชื่อม isolated test server แล้วผ่าน Google Fonts สำหรับ frontend build ใช้ network ที่อนุญาตแล้ว

Tests ครอบคลุม 401/403, default OWNER deny, role/action grants, self escalation, void bypass, payment settings, valid legacy QR, minimal responses, signature/audience/expiry/key-domain errors, cross-session read/write, kitchen list/item scope, anonymous Socket, cross-room join, financial non-delivery พร้อม positive staff receiver, reconnect re-auth, expiry disconnect, closed/expired rejoin, QR rotation และ inactive staff revocation รวม CORS/Swagger

ยังไม่ได้ทำ browser interaction/mobile E2E, load testing, Docker image build หรือ CI execution ไม่อ้างว่า full repo lint/test หรือ production security audit ผ่านทั้งหมด

## Diff summary และขอบเขต

- เพิ่ม `src/security/`: global guard, metadata decorators, explicit-grant policy, Socket identity validation, CORS config, unit tests และ module registration
- เพิ่ม `src/customer/`: signed QR exchange/verification, customer controller/DTOs และ response projection
- แก้ employee controllers ด้วย resource/action metadata; role/order/menu public holes ปิดแล้ว; void-log routing และ VOIDED shortcut แก้เฉพาะเพื่อไม่ข้าม authorization/audit flow
- แก้ gateway ให้ตรวจ identity/scope/recipient และลดข้อมูลส่งออก; ไม่เปลี่ยน status enums/ราคา/checkout/inventory semantics
- แก้ frontend clients/QR/KDS/auth-state disconnect และเลิก log request error objects ที่อาจมี password/bearer config
- เพิ่ม dedicated security DB/test config/integration/client tests; ปรับ ID tests และ start smoke ให้ทดสอบ authenticated contract จริง ไม่ bypass production guards
- เพิ่ม env examples และ Compose passthrough สำหรับ config ใหม่ ไม่ตั้งค่า server grants จริงให้ผู้ใช้
- เก็บหลักฐานงานนี้แยกใน `reports/security-evidence/` ไม่เขียนทับ baseline evidence เก่า

## สิ่งที่ยังต้องตัดสินใจ / ข้อจำกัดที่สำคัญ

1. อนุมัติ/แก้ permission matrix โดยเฉพาะ STAFF table writes, MANAGER payment settings และสิทธิ์ของ custom roles ก่อนตั้ง server grants
2. ระบุ user UUID → kitchen IDs จริงของแต่ละคน; ไม่เปิด all-kitchen ให้ OWNER/MANAGER โดยอนุมานเอง
3. กำหนด actual allowed origins และ provision signing keys ที่แข็งแรงก่อน start ค่า JWT fallback ที่เป็นตัวอย่างใน Compose จากงานเดิมถูกปฏิเสธตอนเริ่ม backend แล้ว ไม่ได้เปลี่ยนหรือเปิดเผย secrets จริงของผู้ใช้
4. การ logout ตัด staff socket ของ browser นี้และล้าง refresh token ตาม flow เดิม แต่ access JWT ที่ถูกคัดลอกยังมีอายุเดิมจนหมด (สูงสุด 15 นาที) การ inactive user/เปลี่ยน role จะถูกตรวจจาก DB ทุก request/delivery ไม่ได้เพิ่ม token denylist/auth-version migration ในงานนี้
5. Default safe-deny ทำให้หน้าพนักงานที่เคยแค่ซ่อนเมนูอาจได้ 403 จนกว่าจะตั้ง grants ที่อนุมัติแล้ว นี่คือผลที่ตั้งใจตามข้อจำกัดของคำขอ ไม่ใช่การอนุมัติ business policy แทนผู้ใช้
6. Recipient revalidation เพิ่ม DB reads ต่อ event; ยังไม่ได้วัดโหลดจริง Financial events ไม่มี unfiltered fallback และไม่ได้เพิ่ม durable outbox ในงานนี้
7. F03/F06/F10/F11/F12/F14/F15 และส่วนอื่นที่ไม่ใช่ authorization ยังเป็นงานแยก ไม่ได้สรุปว่าปัญหาทั้งระบบถูกแก้แล้ว

Backend/frontend process ของ smoke tests ถูกหยุดแล้ว ฐานข้อมูลจำลองและ local PostgreSQL container เก็บไว้ตรวจย้อนหลัง ไม่มีการ deploy/merge/push
