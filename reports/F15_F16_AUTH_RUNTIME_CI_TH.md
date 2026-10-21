# F15/F16 — Auth lifecycle, runtime, environment และ CI

ฐานตรวจล่าสุด: commit `dfec755` รวม F14 แล้ว; การแก้ F15/F16 อยู่ใน working tree ไม่มี deploy/push/merge หรือแก้ production credentials ไม่มี seed/reset/drop/truncate ฐานจริง

## ผลที่ได้และขอบเขต

F15 auth lifecycle และ F16 build/runtime/CI ถูก implement และทดสอบเฉพาะ environment แยก รายงานนี้แยก PASS เฉพาะส่วนออกจาก full-repo source failures และ acceptance ที่ยังไม่มี browser/มือถือจริง ไม่อ้างว่าทั้งระบบพร้อม production หรือ CI ทั้ง repository เขียวแล้ว

อ่าน authStore, api/socket clients, middleware, auth/dashboard layouts, Next config/คู่มือใน next ที่ติดตั้ง, Dockerfiles/ignore files, Compose, Nest main, Prisma config, package+lockfiles, tsconfig/build config, workflows และ docs ปัจจุบันแล้ว

## F15: source bugs และการแก้

เดิมมี auth หลายชุด: Zustand ใช้ createJSONStorage ครอบ custom storage ที่ parse/stringify เองซ้ำ, token อีก key `accessToken` และ cookie `auth-storage` ทำให้ storage contract ไม่ตรงกัน API/socket อ่านคนละแหล่ง Refresh เกิดหนึ่ง request ต่อ 401 และ `/auth/me` ไม่ได้เติม user กลับเข้า store

แก้เป็น:

- Zustand persist + `createJSONStorage(() => localStorage)` ตาม JSON envelope เดียว `auth-storage`; API และ socket อ่านจาก `useAuthStore.getState()` ไม่มีอีก token key/cookie สำหรับตรวจสิทธิ์ ลบเฉพาะสำเนา legacy เมื่อ hydrate
- Explicit hydration หลัง client mount ไม่ใช้ cached user/status เป็นหลักฐาน login; `/auth/me` ตรวจ token และบันทึก user ที่ normalize `role.name` กลับ store ก่อน mount dashboard
- Single-flight refresh ต่อ session revision ใน JS context เดียว API ที่ 401 พร้อมกันรอ promise เดียว และ late 401 ของ token เก่าใช้ token ใหม่ที่มีอยู่แล้ว ไม่ rotate ซ้ำ จำกัด retry หนึ่งครั้ง; login/customer errors และ 403 ไม่เรียก staff refresh
- Revision guard กัน response เก่า, `/auth/me` หรือ refresh ที่มาหลัง clear/login/session replacement ไม่ให้เขียน state หรือ replay request ของ session เก่า
- Logout รอ refresh ที่กำลังทำอยู่ก่อน revoke กับ server; ถ้า access หมดอายุจะ refresh ก่อน revoke แล้วล้าง local auth เสมอ Socket ถูก disconnect และ React Query cache ถูก clear เมื่อเปลี่ยน session (token rotation ปกติไม่ทิ้ง socket listeners)
- Persist `signedOut` ภายใต้ store เดียว ทำให้ explicit logout ตอน offline ยังอยู่หลัง reload ไม่ใช้ cookie เก่ากลับเข้าระบบอัตโนมัติ; login ใหม่ปลด marker
- 401/403 ของ refresh ทำให้ invalidation; network/5xx ของการตรวจ session เก็บ credential ไว้และแสดง retry ไม่ตีความว่า credential ถูกเพิกถอน
- Storage event รองรับการเปลี่ยน session/logout จาก tab อื่น และตรวจ `/auth/me` ใหม่ Route protection เป็น client UX เท่านั้น `middleware.ts` pass-through พร้อมคำอธิบาย ไม่มีการเชื่อ JS-readable cookie; backend REST/Socket guards เป็นผู้บังคับสิทธิ์

Single-flight ครอบคลุม API/socket recovery ใน context เดียว ไม่ใช่ distributed lock ข้าม browser tabs/processes Logout server ปัจจุบันเพิกถอน refresh token; access JWT ที่ออกแล้วมีอายุตาม TTL เดิม ไม่มีการเพิ่ม global access-token blacklist และไม่รับประกันยกเลิก mutation ที่ server เริ่มทำไปแล้ว

## รักษางาน 02

ไม่ได้เปลี่ยน staff JWT/refresh strategy, signing-key checks, permission policy/default-deny, customer binding/projection, kitchen assignment checks หรือ recipient revalidation ไม่มีการใส่ default grants ให้ OWNER/MANAGER/role ใด

เปลี่ยน CORS เฉพาะการ validate exact HTTP(S) origins จาก environment ตอน startup และบังคับให้ production ระบุค่าเอง ยังคง credentials=true, ไม่ใช้ wildcard และไม่ลด HttpOnly/Secure/SameSite=Strict ของ refresh cookie

[Security regression](lifecycle-evidence/security-regression.log) รัน source ปัจจุบันกับ DB ใหม่ 29/29 PASS: anonymous 401, unapproved roles denied, staff/customer isolation, session scope, kitchen assignments, sensitive socket events, revoked/expired identities และ HTTP/WebSocket CORS

## F16: build/runtime/environment

- พาธ backend ที่แก้ในงานก่อนหน้าถูกต้องแล้ว: build `dist/main.js` ตรงกับ `start:prod` และ register-paths เพิ่ม assertion ตอน Docker build และตรวจ runner จริง ไม่ย้อนกลับไป `dist/src/main.js`
- Docker ใช้ Node 22 และ engines/lock metadata ระบุ Node >=22.12 ไม่เปลี่ยน dependency versions; backend runner รัน non-root และรวม generated client, schema/migrations, Prisma CLI/config, tsconfig และ register-paths
- Prisma generate เฉพาะ build/setup; migration เป็น explicit Compose one-off job และ startup backend รอ exit 0; ไม่มี automatic seed/reset เพิ่ม migrations.seed ใน Prisma 7 config และ demo seed ต้อง `ALLOW_DEMO_SEED=1` ใน non-production environment
- เพิ่ม public `GET /health` ที่ query DB จริง คืน 200/503 โดยไม่แสดง connection internals; backend bind `0.0.0.0`; frontend/backend Docker healthchecks และ postgres pg_isready
- Compose ลำดับ postgres healthy → migrate completed successfully → backend healthy → frontend พร้อมใช้งาน DB port bind loopback มี volume แยกตาม project ไม่มี hard-coded production container names/default signing secrets
- Frontend standalone output ถูกต้องอยู่แล้ว runner มี server.js + public/static; NEXT_PUBLIC_API_URL/SOCKET_URL/APP_URL ส่งผ่าน build.args ไม่ใช่ runtime env ที่เปลี่ยน bundle ไม่ได้
- URL ว่างใช้ browser hostname+port3000 สำหรับ API/socket และ browser origin สำหรับ QR; แก้ QR ที่เดิมอาจประกอบด้วย undefined/localhost ผิดเครื่อง Explicit URLs ต้อง rebuild ตามเอกสาร รวมกรณีใช้ custom ports
- HTTP LAN test ใช้ development cookie โดยตั้ง environment ชัดเจน; HTTPS production ใช้ Secure cookie เดิม และ CORS exact origins ตาม environment ไม่เปลี่ยน cookie เป็น cross-site policy
- เอา build-time Google Font fetch ออก ใช้ system sans เพื่อให้ build ไม่ต้องพึ่ง Google Fonts (ไม่มีการดาวน์โหลด font ใหม่)
- Root/backend/frontend env examples เป็น template ไม่มี production credentials และลบ credential literals จาก sample ชื่อเก่า `.env..example`; ไม่ได้แก้ไฟล์ private .env ใด Docker ignore ครอบคลุม .env* เพื่อไม่คัดลอกเข้า image

## CI และเอกสาร

Backend/frontend workflows มี pull_request และ push ที่กำหนด ใช้ npm ci, Node22 และ npm cache ที่ชี้ lockfile ของแพ็กเกจจริง ใช้ lint แบบ read-only ไม่ --fix, tests, build และ Docker build ไม่มี image push

เพิ่ม runtime-smoke workflow สำหรับ fresh source copy/install/migrations/build/start, งาน 02 regression และ Compose test project ใหม่ ใช้ PostgreSQL service/keys แบบ ephemeral เท่านั้น เก็บเฉพาะ logs/fresh command manifest ไม่ upload test metadata ที่มี URL/keys

ทั้งหมด `contents: read` ไม่มี git merge/push/delete branch หรือ Discord webhook แม้ใช้ continue-on-error เพื่อเก็บผลหลายขั้นตอน final gate ต้องให้ทุก lint/test outcome สำเร็จ จึงยัง fail ถ้าข้อผิดพลาดเดิมคงอยู่ [CI policy validation](lifecycle-evidence/ci-policy.log) parse YAML และตรวจ PR trigger/permissions/ไม่มีคำสั่งดังกล่าวครบ 3 workflows; ไม่ได้รัน GitHub Actions remote จริง

README หลักและ backend README เขียนใหม่ แยก implemented/partial/planned, local host vs Compose database URLs, demo seed opt-in, LAN/mobile URL และ CORS, build-time NEXT_PUBLIC, HTTPS production และขอบเขต auth/permission ตามหลักฐาน

## คำสั่งและผลจริง

ทำงานจาก root เว้นแต่ระบุ directory คำสั่งที่ต้องใช้ DB มี ALLOW_SHABU_TEST_DB=1 และตรวจ host/port/user/name เพื่อกันการใช้ app DB; helper รับ SHABU_TEST_ADMIN_URL หรืออ่านเฉพาะ metadata ฐานทดสอบงาน 03 ไม่พิมพ์ credential ลงรายงาน

| Directory / command | ผล | หลักฐาน |
| --- | --- | --- |
| frontend: `npm test` | 23/23 PASS รวม auth 10, customer/staff isolation และ workflow/ID/payment client regressions | [frontend-tests.log](lifecycle-evidence/frontend-tests.log), [auth-unit.log](lifecycle-evidence/auth-unit.log) |
| backend: `npm run test:regression` | 83/83 PASS (12 suites) รวม readiness และ exact CORS | [backend-regressions.log](lifecycle-evidence/backend-regressions.log) |
| root: `ALLOW_SHABU_TEST_DB=1 node scripts/verify-security.cjs` | 29/29 PASS HTTP/JWT/PostgreSQL/Socket งาน 02 บน DB ใหม่ | [security-regression.log](lifecycle-evidence/security-regression.log) |
| root: `ALLOW_SHABU_TEST_DB=1 node scripts/verify-fresh.cjs` | ทุกขั้นตอน exit 0: copy source → npm ci ทั้งสอง package → Prisma generate → migrate deploy → build ทั้งสอง → backend start:prod + frontend standalone → HTTP/JWT/QR/socket smoke | [fresh-commands.json](lifecycle-evidence/fresh-commands.json), [fresh-smoke.log](lifecycle-evidence/fresh-smoke.log) และ fresh-*.log |
| root: `ALLOW_SHABU_TEST_DB=1 node scripts/verify-compose.cjs` | Build ทั้งสอง images, migrations exit0, postgres/backend/frontend healthy, HTTP health/login/QR, anonymous401, exact LAN CORS, runner artifact/config PASS; หยุดเฉพาะ project ทดสอบ | [compose-smoke.log](lifecycle-evidence/compose-smoke.log), [compose-build-up.log](lifecycle-evidence/compose-build-up.log), [compose-status.log](lifecycle-evidence/compose-status.log), [compose-artifact.log](lifecycle-evidence/compose-artifact.log) |
| frontend: eslint auth/store/api/socket/endpoints/layout/provider/middleware ที่แก้ | PASS ไม่มี errors/warnings | [auth-lint.log](lifecycle-evidence/auth-lint.log) |
| backend: eslint readiness/main/CORS ที่แก้ | PASS ไม่มี errors/warnings | [backend-changed-lint.log](lifecycle-evidence/backend-changed-lint.log) |
| frontend: `npm run lint` ทั้ง repo | FAIL 33 errors / 43 warnings จาก legacy pages/components | [frontend-full-lint.log](lifecycle-evidence/frontend-full-lint.log) |
| backend: `npm run lint` ทั้ง repo | FAIL 157 errors / 11 warnings ส่วนใหญ่ formatting/unsafe typing เดิม | [backend-full-lint.log](lifecycle-evidence/backend-full-lint.log) |
| backend: `npm test -- --runInBand` ทั้ง suite | FAIL 23 suites / PASS 12 suites; tests FAIL22/PASS83 โดย scaffold DI/import/export เดิมผิด | [backend-full-tests.log](lifecycle-evidence/backend-full-tests.log) |
| root: `git diff --check` | PASS | ตรวจท้ายงาน |

Fresh copy อยู่ใน temp directory ใหม่ ไม่มี node_modules/.next/dist/.env จาก checkout เดิม รันตาม lockfile จริง ไม่ใช่ clone จาก remote repository ใหม่ [command manifest](lifecycle-evidence/fresh-commands.json) ระบุ directory/คำสั่ง/exit/log ของแต่ละขั้นตอน ตัวรัน standalone ตรวจ HTTP บน LAN interface ของเครื่อง server `192.168.1.87` ทดสอบ QR exchange/customer orders และ authorized room join จริง ไม่ใช่การ render แบบมือถือหรือ browser cookie integration

## Environment blockers แยกจาก source bugs

- Sandbox บล็อก local ports ของ Next workers และ PostgreSQL/Docker sockets ในการลองแรก รันคำสั่งที่จำเป็นด้วยสิทธิ์ที่อนุมัติแล้วจึงผ่าน ไม่ใช่ source bug
- Build แรกพึ่ง Google Fonts แล้ว fetch ไม่ได้ แก้ dependency ของ build ด้วย system font แล้ว fresh/Docker builds ผ่านโดยไม่ต้อง fetch font
- Fresh harness ครั้งแรกส่ง NODE_ENV=development เข้า next build จน prerender global error ล้ม แก้ harness ให้ build ใช้ production และ runtime LAN test ใช้ development แยกกัน เก็บ [initial log](lifecycle-evidence/fresh-smoke-initial.log) และ [initial build](lifecycle-evidence/fresh-frontend-build-initial.log) ไว้ ไม่ใช้เป็นหลักฐานว่าแอป build ไม่ได้
- ไม่มี node_repl/browser-control runtime ใน tools แม้อ่าน browser skill และค้นเครื่องมือตามขั้นตอนแล้ว จึงไม่ได้ browser UI automation, screenshot, reload/logout ด้วย browser จริง หรือทดสอบ handset จริง
- Full lint/scaffold test failures เป็น source failures เดิม ต้องแก้ต่างหาก CI ใหม่จะบล็อกไว้ ไม่ใช้ environment เป็นเหตุผลกลบ error และไม่ลด severity/ลบ tests เพื่อทำให้ CI เขียว

## Acceptance ที่ยังต้องตรวจต่อ

| Acceptance | สถานะ |
| --- | --- |
| refresh หลาย API 401 พร้อมกันไม่แตก | PASS ใน executable tests ที่ใช้ Zustand/Axios จริงและควบคุม HTTP adapter: 8 requests/refreshครั้งเดียว, late401, retry cap, invalid refresh, logout race; real server แยกตรวจ expiry/refresh/revocation แล้ว ยังไม่ใช่ browser E2E |
| reload/logout/expired access | PASS store hydration/late responses/persisted signed-out tests และ real HTTP expiry/refresh/logout; browser UI reload/secure cookie interaction ยังไม่ได้ตรวจ |
| fresh install→generate→migrate→build→start→HTTP smoke | PASS source สำเนาใหม่และ DB ใหม่ ทั้ง native/standalone กับ Docker/Compose; ไม่ใช่ remote clone หรือ production deployment |
| LAN mobile QR/socket | PASS LAN-interface HTTP/QR/scoped customer Socket.IO room จาก server; handset/network firewall ภายนอกและ mobile browser ยังต้องตรวจ |
| CI ไม่แก้ branch เอง | PASS source/YAML/permissions validation ครบ ไม่มี branch operations; remote Actions run ยังไม่รัน และ full quality gates จะยัง fail จาก source debt ข้างต้น |

ไม่มีการเปลี่ยน grants เพื่อผ่าน tests, ไม่ seed ข้อมูลจริง, ไม่ลบ test DB/volume เดิม และไม่ได้อ้างว่าการทดสอบ LAN จาก server เท่ากับการทดสอบบนโทรศัพท์
