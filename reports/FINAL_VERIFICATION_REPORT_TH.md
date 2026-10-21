# Final verification — NO-GO สำหรับ production public access

Run **`run-1792594006532`** บน HEAD `dfec755` **รวม working tree/index F15/F16 ล่าสุด** ไม่ใช่ตรวจเฉพาะ commit ที่ยังไม่มี staged changes ใช้ Node local v25.9.0 และ Docker Node22 ตาม image build

**คำตัดสิน: No-Go** เพราะ authoritative pricing/payment/settlement ยัง BLOCKED, order retry สร้างสอง resources ได้, quality gates ยัง fail และ production grants/browser/mobile acceptance ยังไม่ยืนยัน P0 release/access gates ที่คงค้างทำให้ห้ามเปิด production public access แม้ safe-deny และ security regression ส่วนที่ทดสอบจะผ่าน

ไม่มี production migrations, seed/reset/drop/truncate DB เดิม, เงิน/ข้อมูลลูกค้าจริง, deploy/merge/push/delete branch การรันสร้างเฉพาะ DB/test project ใหม่และหยุดเฉพาะ test children/containers โดยเก็บ fixture DB/volumes ไว้

## เอกสารส่งมอบ

- [Test plan](FINAL_VERIFICATION_PLAN_TH.md)
- [Test Matrix](FINAL_TEST_MATRIX_TH.md) มี Case ID, issue, preconditions, steps, expected, actual, status, evidence, bug references และระดับการทดสอบ
- [CSV](final-verification/run-1792594006532/test-matrix.csv) / [JSON](final-verification/run-1792594006532/test-matrix.json)
- [Bug/blocker register และ follow-up](FINAL_BUG_REGISTER_TH.md)
- [ทุกคำสั่ง/exit/timestamp/log](final-verification/run-1792594006532/commands.json)
- [Source-start](final-verification/run-1792594006532/source-start.json), [source-end](final-verification/run-1792594006532/source-end.json), [integrity check](final-verification/run-1792594006532/source-integrity.json)

Matrix มี **276 rows: PASS232 / FAIL36 / BLOCKED6 / NOT RUN2** เป็นจำนวน rows รวม command gates/assertions/checkpoints และ initial/retest ไม่ใช่จำนวน unique features หรือ pass rate ของระบบ ผล FAIL แรกที่แก้ harness แล้วไม่ถูกลบ ดูสถานะ resolved ใน register และผล retest ประกอบ

## ผลที่รันจริงในรอบนี้

| ชุดตรวจ | Actual | หลักฐาน |
| --- | --- | --- |
| Backend regression ที่ระบุ | **83/83 PASS**, 12 suites | [JSON](final-verification/run-1792594006532/backend-regression.results.json) |
| Backend full unit | **83 PASS / 22 FAIL**, 12 passed suites / 23 failed suites, 0 pending | [log](final-verification/run-1792594006532/backend-full-unit.log) |
| Frontend module/adapter contracts | **23/23 PASS**, รวม auth 10, QR/socket isolation, stale-state helpers, Decimal display | [TAP](final-verification/run-1792594006532/frontend-tests.log) |
| Security real HTTP/JWT/PostgreSQL/Socket | **29/29 PASS** ภายใต้ fixture grants และ default-deny | [JSON](final-verification/run-1792594006532/security.results.json) |
| Workflow/QR/KDS real integration | **21/21 PASS** | [JSON](final-verification/run-1792594006532/workflow.results.json) |
| Payment safety integration | **19/19 PASS** สำหรับ safe-deny/opening concurrency/rollback/settings restart ไม่ใช่การรับชำระสำเร็จ | [JSON](final-verification/run-1792594006532/payment.results.json) |
| ID HTTP integration | **6/6 PASS** | [JSON](final-verification/run-1792594006532/ids.results.json) |
| Inventory integration | **10/10 PASS** service/PostgreSQL; HTTP case injects fixture guard, event notification ใช้ gateway spy | [JSON](final-verification/run-1792594006532/inventory.results.json) |
| New cross-module acceptance probes | **2 PASS / 1 FAIL** ทั้ง initial และ retest; duplicate order retry ยัง fail | [latest JSON](final-verification/run-1792594006532/journey-retest.results.json) |
| Pricing proposal fixtures | **5/5 PASS เฉพาะ design hypothesis** ไม่ใช่ runtime/approved business acceptance | [JSON](final-verification/run-1792594006532/pricing-proposal.results.json) |
| Backend/frontend builds | PASS ทั้ง local production build, fresh copy และ Docker | [backend](final-verification/run-1792594006532/backend-build.log), [frontend](final-verification/run-1792594006532/frontend-build.log) |
| Full lint | Frontend **33 errors/43 warnings**, backend latest **157 errors/11 warnings** — FAIL | [frontend](final-verification/run-1792594006532/frontend-lint.log), [backend](final-verification/run-1792594006532/backend-lint-retest.log) |
| New/modified tests lint | PASS หลังใช้ typed response ใน test ใหม่ | [log](final-verification/run-1792594006532/new-tests-lint.log) |
| Standard default E2E config + app template | **FAIL ก่อน assertion**, unresolved src alias; 0 tests | [log](final-verification/run-1792594006532/backend-default-e2e.log) |
| Display-number migrations | Initial harness FAIL; fixed historical schema/fixtures แล้ว **retest PASS** empty/populated/sequence/constraints/schema diff/replay | [initial](final-verification/run-1792594006532/id-migrations.log), [latest](final-verification/run-1792594006532/id-migrations-retest.log) |
| Payment migration/preflight | PASS รวม duplicated legacy ACTIVE rows ถูกปฏิเสธโดย data/DDL rollback และเงิน Decimal เดิมคงเดิม | [latest](final-verification/run-1792594006532/payment-migrations-retest.log) |
| Inventory migration | PASS opening balance เท่ายอด fixtureเดิม และ replay ไม่เพิ่ม movement | [log](final-verification/run-1792594006532/inventory-migrations.log) |
| Fresh source-copy install→generate→migrate→build→start→HTTP/LAN socket | PASS ใช้ DB ใหม่และไม่มี artifacts/env จาก checkout เดิม | [steps/exit](final-verification/run-1792594006532/fresh-runtime/fresh-commands.json), [smoke](final-verification/run-1792594006532/fresh-runtime.log) |
| Docker Compose | Initial verifier env propagation FAIL; fixed แล้ว **retest PASS** migration exit0 + postgres/backend/frontend healthy, HTTP/LAN CORS/artifact checks | [initial](final-verification/run-1792594006532/compose-runtime.log), [latest](final-verification/run-1792594006532/compose-runtime-retest.log), [healthy](final-verification/run-1792594006532/compose-runtime-retest/compose-status.log) |
| CI mutation policy | YAML/PR triggers/contents:read/no merge-push-delete-webhook PASS เฉพาะ source validation; ไม่ได้รัน remote Actions | [log](final-verification/run-1792594006532/ci-policy.log) |

## Journey ตามข้อ 2 ของคำขอ

ทดสอบผ่าน real HTTP/JWT/DB ด้วย actor fixture ที่มี explicit test grants และ menu/tier/counts ที่สร้างเฉพาะ test:

| จุดตรวจ | Expected / actual | สถานะ |
| --- | --- | --- |
| เปิดโต๊ะ + เลือก tier + ผู้ใหญ่2/เด็ก1 | DB บันทึก tier/counts ตรงและ ACTIVE | PASS |
| QR exchange + menu | ได้ scoped credential; เห็นเฉพาะ menu ใน tier ที่ available; ไม่เห็น unavailable/outside-tier | PASS |
| สร้าง order → KDS → PREPARING → SERVED | KDS query พบ item และ DB ลง SERVED | PASS |
| Checkout safety | HTTP503 CHECKOUT_POLICY_PENDING; invoice ไม่เพิ่ม; session ACTIVE/table OCCUPIED; ไม่สร้าง PAID ปลอม | PASS เฉพาะ guard |
| Authoritative amount/discount + payment confirmation + invoice ใหม่ | ยังไม่มี approved policy/confirmation implementation | **BLOCKED** |
| Cleaning → available หลัง verified settlement | ไม่มี successful settlement ให้ต่อ happy path | **BLOCKED** |
| Manual status branch แยก | CLOSED ทำ CLEANING; เปลี่ยน AVAILABLE ได้ แต่เปิดใหม่409เพราะยังพิสูจน์ชำระไม่ได้ และไม่มี invoice | PASS เฉพาะ manual/hold behavior ไม่ใช่ paid journey |

[Actual checkpoints และ duplicate retry](final-verification/run-1792594006532/journey-retest/journey-facts.json) เส้นทาง **เปิดโต๊ะถึง available หลังชำระสำเร็จทั้งเส้นยังไม่ผ่าน** ไม่มีการใช้ proposal price, legacy invoice หรือ QR creation เป็นหลักฐานรับเงินจริง

## สรุป F01–F16 ตามขอบเขตที่ทดสอบ

| Issue | ผลตรวจล่าสุด / สิ่งที่ยังค้าง |
| --- | --- |
| F01 | Default-deny และ fixture OWNER/MANAGER/STAFF/KITCHEN permission positives/negatives ผ่าน; production matrix/provisioning **BLOCKED** |
| F02 | Anonymous staff API denied, customer/staff token isolation และ cross-session QR HTTP/socket ผ่านใน test environment |
| F03 (P0) | Tampered totals/excessive discounts ไม่สร้าง invoice เพราะ safe-deny; authoritative pricing/discount/VAT/rounding จริง **BLOCKED** ยังไม่ถือว่าฟีเจอร์คิดเงินผ่าน |
| F04 | Raw/prefixed/display/malformed/nonexistent IDs unit + HTTP ผ่าน |
| F05 | Migration empty/existing/replay/PK/FK/sequence preservation ผ่านหลังแก้ harness ที่พิสูจน์ว่าล้าสมัย |
| F06 | Tier/availability/quantity/server endTime validation ผ่าน |
| F07 | Anonymous/forged Socket, cross-room/assignment, sensitive event delivery และ revocation ผ่านใน test fixtures |
| F08 | Actual socket reconnect/resync และ client stale-state helper ผ่าน; UI rendering/mobile browser **NOT RUN** |
| F09 | Canonical kitchens route และ static void-logs route ผ่าน real integration |
| F10 | Concurrent/retried table opening/actor-key/conflict/rollback ผ่าน; invoice success idempotency **BLOCKED**; order retry acceptance **FAIL** |
| F11 | Closed/expired session ordering/credential denial และ hold behavior ผ่าน; overdue settlement/paid cleanup **BLOCKED** |
| F12 | Settings DB/actor/null/restart และ legacy Decimal display/receipt helper ผ่าน; approved payment QR payload/provider verification **BLOCKED/NOT RUN** |
| F13 | Invalid/backward/skipped/VOIDED shortcut denied, audited voidครั้งเดียว และ atomic rollback/event-after-commit ผ่าน |
| F14 | Manual ledger/retry/parallel requests/insufficient stock/threshold/reconciliation ผ่าน; automatic recipe deduction/eligible void restoration **BLOCKED** |
| F15 | Single-flight/late401/logout race/persisted signed-out/hydrate contracts ผ่าน; real server expired access/refresh/logout revocation ผ่าน fresh smoke; browser reload/cookie UX **NOT RUN** |
| F16 | Build/fresh-runtime/Compose/CI read-only policy ผ่านตามระดับที่ระบุ; full lint/unit/default E2E ยัง **FAIL** |

F01/F02/F07 ไม่พบ bypass ในกรณีที่ execute ไม่ได้ตีความเป็นการอนุมัติ access policy ของ production ส่วน F03 ถูก mitigate ด้วย safe-deny แต่ P0 release prerequisite ยังไม่ครบ จึงคง No-Go ไม่เปิด payment เพื่อทำให้ test journey ผ่าน

## การแก้ภายในรอบ final

แก้เฉพาะ test infrastructure ที่ reproduce แล้ว: historical migration reconstruction/cutoff และ Compose verifier isolation เมื่อ inherited shell env shadow test env รวม typed response ใน test ใหม่ เพิ่ม per-run artifact directory เพื่อไม่ทับหลักฐานเก่า และเพิ่ม runner/acceptance tests/plan/matrix

**ไม่มี application/schema/package/Docker/Compose product input เปลี่ยนระหว่างรัน** จาก SHA256 compare; [integrity](final-verification/run-1792594006532/source-integrity.json) ระบุรายการ test/harness ที่เปลี่ยนและถูก retest ไม่ rewrite auth/payment/stock policy หรือแก้ duplicate-order contract เอง

## Blockers และ follow-up ก่อน Go

1. **P0 release/access:** อนุมัติ pricing/settlement/payment confirmation/QR expectations และ production grants/assignments/provisioning ให้ชัด แล้ว implement/test ด้วย non-money fixtures การตอบ503อย่างปลอดภัยยังทำให้ธุรกรรมจริงใช้งานไม่ได้
2. **Order retry:** เพิ่ม explicit idempotency contract โดยรักษาการสั่งรายการเดิมใหม่ได้ด้วย reference ใหม่ ปัจจุบันมี reproducible duplicate orders และ failing acceptance test คงไว้
3. **Quality gates:** แก้ full lint/scaffold DI/import/default E2E entrypoint ใน follow-up แยก ไม่ลบ/skip tests หรือ weaken rules เพื่อกลบผล
4. **Stock policy:** อนุมัติจุดตัด/คืน/units แล้วเพิ่ม transaction + reference tests ก่อนอ้าง voidคืน stock ผ่าน
5. **Environment acceptance:** จัด browser/มือถือจริงและ approved provider sandbox เพื่อทดสอบ UI reload/logout/Secure-cookie, stale-state, QR scan/reconnect/expiry และ payment payload ตาม expected ที่อนุมัติ

ไม่มี browser-control runtime ใน tools และไม่มี handset/provider sandbox จึงบันทึกเป็น NOT RUN/BLOCKED ไม่สร้างผลจำลองเป็น browser/mobile PASS LAN smoke เป็น connection จากเครื่อง server ผ่าน LAN interface เท่านั้น

## รันซ้ำ

จาก root มี dependencies ตาม lockfiles และ isolated PostgreSQL test user ที่สร้าง DB ได้บน 127.0.0.1:55432/shabu_test เท่านั้น:

```sh
env ALLOW_SHABU_TEST_DB=1 node scripts/final-verification.cjs
# ระบุ SHABU_TEST_ADMIN_URL ได้หากไม่ใช้ metadata ฐานทดสอบงาน 03
# รันเฉพาะ retest ของ run ที่เก็บไว้ (สร้าง DB/project ใหม่ ไม่ reset เดิม):
env ALLOW_SHABU_TEST_DB=1 node scripts/final-verification.cjs --retest=run-1792594006532
# สร้าง matrix ใหม่จากผลเดิม ไม่อ้างเป็นการรันทดสอบใหม่:
env ALLOW_SHABU_TEST_DB=1 node scripts/final-verification.cjs --matrix=run-1792594006532
```

Wrapper จบรอบนี้ด้วย exit1/No-Go; exit ของแต่ละคำสั่งอยู่ใน manifest จึงแยก known source failure, failing acceptance, resolved harness failure และ business/environment blockers ได้ ทุกผล initial/retest อยู่ครบใน artifact directory เดียว metadata ที่มี connection URLs/test keys ถูก gitignore และไม่รวมใน matrix/public logs
