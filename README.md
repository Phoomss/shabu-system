# Shabu System

**Final verification: NO-GO สำหรับ production public access.** Checkout/payment policy ยัง BLOCKED, order retry สร้าง duplicate ได้ และ full quality gates ยัง fail ดู [ผลรอบล่าสุด](reports/FINAL_VERIFICATION_REPORT_TH.md), [Test Matrix](reports/FINAL_TEST_MATRIX_TH.md) และ [bug/follow-up](reports/FINAL_BUG_REGISTER_TH.md) ก่อนตีความสถานะฟีเจอร์ด้านล่าง

Next.js 16 / React 19 frontend, NestJS backend, Prisma 7 / PostgreSQL และ Socket.IO ใช้ Node.js 22.12+ (แนะนำ Node 22 ตาม `.nvmrc`) และ npm lockfiles แยก frontend/backend

## สถานะตามหลักฐาน

| สถานะ | สิ่งที่มีอยู่ |
| --- | --- |
| Implemented | REST/Socket authorization แบบ default-deny, staff/customer credential แยก domain, QR ผูก session, kitchen assignments และ safe customer projections — งาน 02 regression 29 tests |
| Implemented | ID contracts, QR/KDS reconnect และ forward transition/audited void จากงาน 03 |
| Implemented | F14 manual stock ledger, idempotency, PostgreSQL row lock, reconciliation และ threshold ที่บันทึกจริง |
| Implemented | F15 Zustand JSON storage แหล่งเดียว, single-flight refresh, hydrate `/auth/me`, logout/invalidation และ stale-response protection; customer ไม่ใช้ staff refresh |
| Implemented | F16 Docker build/start paths, explicit migrate job, DB/backend/frontend healthchecks, sample env และ read-only CI ไม่มี auto-merge/delete branch |
| Partial | Payment มี safety foundation แต่ยังไม่ใช่การยืนยันเงินจาก provider; ดูรายงาน payment ก่อนเปิดใช้จริง |
| Partial | CI มี lint/test/build/PR gates จริง แต่ full lint และ scaffold unit tests เดิมยังล้มเหลวและจะบล็อก CI ไม่ใช่การอ้างว่าทั้ง repository ผ่าน |
| Partial | LAN HTTP/QR/customer socket ผ่านจากเครื่อง server; ยังไม่ได้ทดสอบด้วยมือถือจริง และ environment นี้ไม่มี browser-control runtime สำหรับ UI acceptance |
| Planned / รออนุมัติ | recipe deduction/void stock return ตาม transition, production permission matrix/assignments และ payment business rules ที่รายงานระบุว่ายังรอข้อสรุป |

หลักฐานล่าสุด: [F15/F16](reports/F15_F16_AUTH_RUNTIME_CI_TH.md), [F14](reports/F14_INVENTORY_IMPLEMENTATION_TH.md), [งาน 02](reports/SECURITY_PERMISSION_MATRIX_TH.md), [งาน 03](reports/F06_F08_F09_F13_WORKFLOW_IMPLEMENTATION_TH.md)

ชื่อ role ใน UI เป็นการจัดหน้าเพื่อ UX เท่านั้น OWNER ไม่ได้มีสิทธิ์ backend โดยอัตโนมัติ `STAFF_PERMISSION_GRANTS={}` และ `KITCHEN_USER_ASSIGNMENTS={}` หมายถึงไม่มี business grants จนกว่าจะกำหนดตามนโยบายที่อนุมัติ `/auth/me` เป็นสิทธิ์ self profile ส่วน REST/Socket guards เป็นผู้บังคับสิทธิ์จริง

## Local development

1. ใช้ PostgreSQL แยกสำหรับ development; หากใช้ service postgres ใน Compose ให้ copy `.env.example` เป็น `.env` ที่ยังไม่มีอยู่ แล้วตั้ง password/signing keys ของ development และใช้ `docker compose --env-file .env up -d postgres` ไม่ reset volume เดิม
2. Copy `backend/.env.example` เป็น `backend/.env` ที่ยังไม่มีอยู่ ตั้ง `DATABASE_URL` เป็น host ที่ Node เข้าถึงได้ เช่น `127.0.0.1:5432` และใช้ password เดียวกับฐาน local; ใส่ private signing keys คนละค่ากัน ค่า `replace-with-*` จะถูกปฏิเสธตั้งแต่ startup
3. ใน backend:

```sh
npm ci
npm run prisma:generate
npm run migrate:deploy
npm run build
npm run start:prod
# หรือ npm run start:dev สำหรับ watch
```

4. ใน frontend copy `.env.example` เป็น `.env.local` หากต้องปรับ URL แล้วรัน:

```sh
npm ci
npm run dev
# หรือ npm run build แล้ว npm run start
```

Frontend ปกติพอร์ต 3001, backend พอร์ต 3000; backend bind `0.0.0.0` ทดสอบ `GET http://127.0.0.1:3000/health` ได้ 200 เมื่อ DB ติดต่อได้ และ 503 เมื่อ DB query ล้มเหลว health ไม่ใช่สิทธิ์เข้าข้อมูลร้าน

Migrate ใช้ `prisma.config.ts` + `DATABASE_URL` ไม่มี automatic seed/reset ข้อมูลเริ่มต้น staff ต้อง provision ตามกระบวนการที่อนุมัติ หรือใช้ demo seed เฉพาะฐาน development ที่ทิ้งได้:

```sh
# จาก backend; ตรวจ DATABASE_URL ด้วยตนเองก่อนใช้
ALLOW_DEMO_SEED=1 NODE_ENV=development npm run seed
```

Demo seed ถูกปฏิเสธถ้าไม่มี opt-in หรือ `NODE_ENV=production` และไม่ใช่ production account provisioning

## LAN / mobile QR

- เปิด POS จากมือถือหรือคอมผ่าน `http://<SERVER_LAN_IP>:3001` เพื่อให้ QR ชี้กลับ server จริง ค่า APP URL ว่างใช้ origin ของ browser ที่สร้าง QR; หากสร้าง QR จาก localhost ให้กำหนด `NEXT_PUBLIC_APP_URL` เป็น LAN URL แล้ว rebuild
- API/socket URL ว่างจะใช้ hostname ของ browser กับพอร์ต 3000 แทน localhost ของมือถือ หากพอร์ต/API host ต่างออกไปให้ตั้ง `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL` ชัดเจน
- เพิ่ม origin ของหน้าเว็บ เช่น `http://<SERVER_LAN_IP>:3001` ใน backend `CORS_ORIGINS` พร้อมพอร์ต และเปิดพอร์ต API/frontend ตาม network/firewall ของ environment ห้ามใช้ wildcard origin
- HTTP LAN test ใช้ `NODE_ENV=development` (Compose: `APP_NODE_ENV=development`) เพื่อให้ refresh cookie ส่งผ่าน HTTP ได้ การใช้งานจริงใช้ HTTPS และ production cookie ที่เป็น Secure + HttpOnly + SameSite=Strict
- หน้าเว็บ/API ต้องอยู่ในบริบท same-site ที่รองรับ cookie Strict เช่น subdomain ใต้ site เดียวกัน; cross-site deployment ต้องทบทวน cookie policy แยก ไม่ได้ลดความเข้มของ cookie ในงานนี้

`NEXT_PUBLIC_*` เป็น **build-time configuration** ถูกฝังใน JavaScript การแก้ runtime env ใน container ที่ build แล้วไม่เปลี่ยน URL ต้อง rebuild frontend; Compose ส่งค่าผ่าน `build.args` ไม่ใช่ runtime environment

## Docker / deployment preparation

ใช้ `.env.example` ที่ root เป็น template เท่านั้น ตัวอย่างไม่มี production secrets เติมค่าจริงในไฟล์ private ของ environment เอง โดย `DATABASE_URL` ของ Compose ต้องชี้ `postgres:5432` ไม่ใช่ localhost ของเครื่อง host

```sh
docker compose --env-file .env config --quiet
docker compose --env-file .env build
docker compose --env-file .env up -d
```

ลำดับคือ postgres healthy → migrate job จบ exit 0 → backend healthy → frontend เริ่มทำงาน ไม่มี seed ใน entrypoint พอร์ต DB bind เฉพาะ loopback พอร์ต backend/frontend ตั้งผ่าน `BACKEND_PORT`/`FRONTEND_PORT`

Backend image ใช้ `dist/main.js` กับ `register-paths.cjs` ตาม `start:prod` และรวม generated Prisma client, schema/migrations, `prisma.config.ts`, tsconfig และ CLI สำหรับ explicit migration job ส่วน frontend ใช้ standalone `server.js` พร้อม public/static assets ทั้งสอง image รันด้วย non-root user

Production ต้องตั้ง HTTPS, exact CORS origins, signing keys ที่แยกกัน, reviewed grants/assignments, backups และแผน migration ของ environment ก่อนดำเนินการ คำสั่งนี้เป็นเอกสาร ไม่ได้มีการ deploy/push/merge โดยงานนี้

## Verification และ CI

```sh
# frontend
npm test
npm run lint
npm run build
# backend
npm run test:regression
npm test -- --runInBand
npm run lint
npm run build
```

`npm run lint` ไม่ใช้ `--fix` ทั้งสองแพ็กเกจ CI รับ pull_request และ push ที่กำหนด ใช้ npm ci + lockfile cache paths และ `contents: read`; ไม่มี merge/push/delete branch/Discord steps แม้มี `continue-on-error` เพื่อเก็บผลหลายขั้นตอน **final gate บังคับให้ทุก lint/test outcome สำเร็จ** จึงไม่ซ่อน failure เดิม

ทดสอบจาก root บน environment แยกเท่านั้น (PostgreSQL test user `shabu_test` บน `127.0.0.1:55432/shabu_test` ที่สร้าง database ใหม่ได้):

```sh
ALLOW_SHABU_TEST_DB=1 SHABU_TEST_ADMIN_URL='<isolated test URL>' node scripts/verify-fresh.cjs
ALLOW_SHABU_TEST_DB=1 SHABU_TEST_ADMIN_URL='<isolated test URL>' node scripts/verify-security.cjs
ALLOW_SHABU_TEST_DB=1 node scripts/verify-compose.cjs
```

Fresh verifier copy source ใหม่โดยไม่เอา `.env`, node_modules หรือ build artifacts เดิมไปด้วย แล้ว install → generate → migrate → build → start → HTTP/JWT/QR/socket smoke; Compose verifier ใช้ project/DB volume ใหม่และพอร์ต 55433/3330/3331 ทั้งสองหยุดเฉพาะ process/container ของ test และเก็บ DB ไว้ ไม่ drop/reset ฐานเดิม `verify-fresh` เป็น fresh source copy ไม่ใช่การ clone remote repository

ผลแต่ละคำสั่งและ exit code อยู่ใน `reports/lifecycle-evidence/` ส่วน metadata ที่มี URL/key ทดสอบถูก gitignore และไม่ upload เป็น CI artifacts ต้องแยก full-repo source failures, sandbox/network blockers และ acceptance ที่ยังไม่ได้ทดสอบออกจากผล PASS เฉพาะส่วน
