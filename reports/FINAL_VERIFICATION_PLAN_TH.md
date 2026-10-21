# Final verification plan — F01–F16

ใช้ HEAD และ working tree ล่าสุดรวม staged/uncommitted changes เป็นฐาน เก็บ source fingerprints และคำสั่ง/exit codes ต่อ run ไม่นับผลจากรายงานรอบเก่าเป็น PASS รอบนี้

## ขอบเขตและวิธี

1. Build/lint/unit ทั้ง repository แยกจาก regression suites; เก็บ failing scaffolds และทุก error ไม่ skip เพื่อทำผลเขียว
2. สร้าง PostgreSQL DB ใหม่สำหรับแต่ละ integration suite บน isolated test server 127.0.0.1:55432 เท่านั้น; fixture users/tables/tiers/orders/invoices ไม่ใช่ลูกค้าจริง ไม่มี seed หรือ production migrations
3. รัน real HTTP/JWT/PostgreSQL/Socket suites สำหรับ role grants/default-deny, session/customer scope, ID contracts, ordering/KDS/expiry/void, payment safe-deny/concurrency/rollback/settings restart และ inventory ledger
4. เพิ่ม cross-module journey: เปิดโต๊ะพร้อม tier/counts → QR scoped menu → order → KDS → SERVED → ตรวจ checkout policy block และผล DB; แยก guard PASS ออกจาก full payment journey BLOCKED
5. เพิ่ม regression expectation ของ retry order ด้วย Idempotency-Key ผ่าน HTTP ถ้าเกิด duplicate ให้เป็น FAIL และเก็บไว้ ไม่เปลี่ยน expected ให้ยอมรับ duplicate
6. ตรวจ migrations ทั้ง empty/populated/replay/preflight duplicate โดยใช้ DB ใหม่; หาก harness เก่าไม่รองรับ migration ล่าสุด ให้เก็บ failure ก่อนแก้เฉพาะ harness แล้วรันซ้ำ
7. รัน fresh source-copy install/generate/migrate/build/start/HTTP/LAN socket และ Compose ใหม่หนึ่ง project/volume; หยุดเฉพาะ test children/projects เก็บข้อมูลไว้ ไม่ reset/drop/truncate ฐานเดิม
8. Matrix แยก assertion-level executable cases, requirement-level journey/policy blockers และ NOT RUN ของ environment ที่ไม่มี browser/handset/provider acceptance

## กติกาการสรุป

- PASS ต้องมี assertion/command ที่รันใน run นี้ ระบุระดับ unit/adapter/HTTP/DB/socket/container ชัดเจน ไม่อนุมานว่า browser หรือ production grants ผ่าน
- FAIL = expected ไม่ตรง actual รวม lint/build/scaffold failures และ contract regression ที่ยืนยันได้
- BLOCKED = ไม่มี approved business expected/policy หรือ infrastructure ที่จำเป็น ห้ามเดา payment/stock/tax/rounding rules
- NOT RUN = ไม่ได้ execute เช่น provider/bank QR scan/มือถือจริง; ทุกกรณีต้องมีเหตุผลและ follow-up
- Go/No-Go: P0 unresolved, payment happy path blocked, authorization policy ยังไม่อนุมัติ, failing quality gates หรือ release-critical verification gaps ทำให้ No-Go สำหรับ production public access

ไม่ใช้เงินจริง/ข้อมูลจริง ไม่ deploy/merge/push/delete branch ไม่ซ่อน tests และไม่ rewrite ระบบ แก้เฉพาะ regression ที่พิสูจน์แล้วใน scope
