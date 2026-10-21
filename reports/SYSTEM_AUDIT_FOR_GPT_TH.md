# รายงานตรวจสอบ Shabu System สำหรับให้ GPT วิเคราะห์และสร้าง prompt

วันที่ตรวจ: 21 ตุลาคม 2026 (Asia/Bangkok)  
โค้ดอ้างอิง: commit `f18cb42`  
วิธีใช้: ส่งไฟล์นี้พร้อม `GPT_ANALYSIS_PROMPT_TH.md` ให้ GPT; หากจะให้แก้โค้ดจริง ต้องให้เข้าถึง repository และตรวจหลักฐานซ้ำ

## 1. ผลประเมิน

ระบบมีโครงสร้างงานร้านชาบูครอบคลุม POS, QR ordering, KDS, จัดการเมนู/แพ็กเกจ/โต๊ะ/ผู้ใช้, วัตถุดิบ และใบเสร็จ แต่พบข้อบกพร่องในขอบเขตสิทธิ์ การเชื่อมต่อ ID การบังคับกติกาสั่งอาหาร และการชำระเงิน จึงยังไม่ควรถือว่าพร้อมใช้งานจริงจากหลักฐานรอบนี้

รายงานนี้เป็นการตรวจ source code, schema, migration, Docker และ CI พร้อมทดลองคำสั่งตรวจพื้นฐาน ไม่ใช่ผลทดสอบระบบที่เปิดใช้งานครบทุกบริการ ไม่ได้ยืนยันว่ามีการโจมตีหรือข้อมูลสูญหายเกิดขึ้นจริง

ไม่มีการแก้ business logic, ติดตั้ง dependencies, รัน seed/migration, เปลี่ยนข้อมูลฐานข้อมูล หรือ deploy ในการตรวจครั้งนี้ ไม่ได้อ่านหรือนำค่าจากไฟล์ secret มาใส่รายงาน

## 2. ภาพรวมทางเทคนิค

| ส่วน | สิ่งที่พบใน repository |
|---|---|
| Frontend | Next.js 16.2.1, React 19.2.4, TypeScript, Tailwind 4, Radix/shadcn, Zustand, TanStack Query, Axios |
| Backend | NestJS 11, TypeScript, Passport JWT, bcrypt, class-validator, Swagger, Schedule |
| Database | PostgreSQL, Prisma 7.4.2 ตามช่วงเวอร์ชันใน package.json, adapter-pg |
| Realtime | Socket.IO; rooms `kitchen:{id}` และ `session:{id}` |
| Deployment | Docker Compose: PostgreSQL 5432, backend 3000, frontend 3001 |
| CI | แยก backend/frontend ใน `.github/workflows/` |

เวอร์ชันที่เป็นช่วง เช่น `^7.4.2` ไม่ใช่การยืนยันเวอร์ชันที่ติดตั้งจริง เครื่องตรวจใช้ Node `v25.9.0`, npm `11.12.1`; Docker/CI กำหนด Node 20

เส้นทางหลัก frontend: `/login`, `/dashboard`, `/pos`, `/kds`, `/tables`, `/sessions`, `/orders`, `/menus`, `/categories`, `/tiers`, `/kitchen-sections`, `/ingredients`, `/invoices`, `/users`, `/roles`, `/void-logs`, `/order/[token]`

API หลัก: `/auth`, `/role` (เอกพจน์), `/users`, `/kitchens`, `/categories`, `/tiers`, `/menu-items`, `/tables`, `/sessions`, `/orders`, `/ingredients`, `/invoices`, `/settings/payment`; Swagger `/api-docs`

ข้อมูลสัมพันธ์หลัก:

```text
Role -> User -> Invoice / VoidLog
Table -> Session -> Order -> OrderItem -> MenuItem -> Category / KitchenSection
Tier -> Session; Tier <-> MenuItem ผ่าน TierMenuItem
MenuItem <-> Ingredient ผ่าน Recipe
Session -> Invoice; OrderItem -> VoidLog
```

ลำดับงานที่ระบบตั้งใจรองรับ: พนักงาน login → เปิดโต๊ะและเลือกแพ็กเกจ/จำนวนคน → ลูกค้าสแกน QR → สั่งอาหาร → ครัวเปลี่ยนสถานะ → ชำระเงินและออกใบเสร็จ → โต๊ะรอทำความสะอาด → กลับสู่ว่าง

จุดที่มีอยู่แล้ว: hash รหัสผ่าน, ตรวจผู้ใช้ active ใน JWT strategies, refresh cookie แบบ HttpOnly, global ValidationPipe แบบ whitelist/forbidNonWhitelisted, response envelope `{status,message,data}`, transaction ในการสร้าง session/ใบเสร็จ/void บางส่วน และแยก modules ตามโดเมน อย่างไรก็ตาม transaction ที่มีอยู่ยังไม่ครอบคลุมเงื่อนไขป้องกันคำขอพร้อมกัน

## 3. ผลคำสั่งที่ทดลองจริง

| คำสั่ง | ผล | ความหมาย |
|---|---|---|
| `git status --short` ก่อนตรวจ | ไม่มีรายการเปลี่ยนแปลง | เริ่มจาก working tree สะอาด |
| backend: `npm run build` | exit 1, compiler รายงาน 293 errors; ตัวอย่างหา `prisma/config`, `@prisma/client`, Nest packages และ Node types ไม่เจอ | dependencies ไม่พร้อม; ยังสรุปไม่ได้ว่า build หลังติดตั้งจะผ่านหรือไม่ |
| backend: `npm test -- --runInBand` | exit 127, `jest: command not found` | ยังไม่มีผล unit test ที่รันสำเร็จ |
| frontend: `npm run lint` | exit 127, `eslint: command not found` | ยังไม่มีผล lint |
| frontend: `npm run build` | exit 127, `next: command not found` | ยังไม่มีผล production build |

ไม่พบโฟลเดอร์ `node_modules` ของทั้งสองแอปในการตรวจเบื้องต้น แม้คำสั่ง backend build จะเรียก compiler ที่เครื่องมีได้ก็ตาม ไม่ควรใช้จำนวน compiler errors ข้างต้นเป็นจำนวนบั๊กจริง

ยังไม่ได้ทดสอบ: HTTP/API ที่รันจริง, Browser/mobile UI, JWT/refresh แบบ end-to-end, Socket reconnect, PostgreSQL migration บนฐานข้อมูลว่าง, concurrent requests, Docker build และการสแกน QR ชำระเงินด้วยแอปธนาคาร ไม่ได้ทำ dependency vulnerability audit จึงไม่มีข้อสรุปเรื่อง CVE

## 4. รายการปัญหาเรียงตามความสำคัญ

P0 = ควรแก้ก่อนเปิดรับผู้ใช้จริง, P1 = กระทบ workflow หลัก/ความถูกต้อง, P2 = ความเสถียรและการดูแลรักษา  
“ยืนยันจากโค้ด” หมายถึงพบ implementation ตามที่ระบุ; ผลขณะใช้งานจริงยังต้องทดสอบ ส่วน race condition ระบุเป็นความเสี่ยงที่ต้องทดสอบพร้อมกัน

### F01 — P0: การตรวจสิทธิ์ฝั่ง backend ไม่ครอบคลุม

- หลักฐาน: `backend/src/role/role.controller.ts` ไม่มี guard; `backend/src/user/user.controller.ts` มี JwtGuard แต่ไม่มี role guard; controller จัดการข้อมูลส่วนใหญ่ตรวจเฉพาะ JWT และ `app.module.ts` ไม่มี global role guard
- ผล: endpoint จัดการ role เปิดโดยไม่ตรวจ login; ผู้ใช้ที่ login แล้วไม่มีการบังคับสิทธิ์ OWNER/MANAGER ในเส้นทางจัดการผู้ใช้/บทบาทหรือ void ตามที่ชื่อฟังก์ชันสื่อ ผู้ใช้สามารถเรียก API โดยตรงได้แม้เมนูใน UI ถูกซ่อน
- แก้: กำหนด permission matrix, ใช้ server-side role/permission guard และตรวจขอบเขตครัว; คง public endpoints เฉพาะที่จำเป็นต่อ QR ordering
- เกณฑ์ผ่าน: anonymous ได้ 401 ในงานพนักงาน; role ที่ไม่อนุญาตได้ 403; STAFF/KITCHEN เปลี่ยน role ของตัวเองหรือผู้ใช้อื่นไม่ได้ และ void ตามสิทธิ์ที่ตกลงเท่านั้น

### F02 — P0: Public orders ไม่ผูกสิทธิ์กับ QR token

- หลักฐาน: `backend/src/orders/orders.controller.ts` เปิด `GET /orders` และ `POST /orders`; `OrdersService.findAll()` ไม่รับ sessionId ก็อ่านทุกออเดอร์; create รับเพียง sessionId โดยไม่พิสูจน์ QR token
- ผล: anonymous อ่านรายการออเดอร์ทั้งหมดได้ตามโค้ด และใช้ sessionId ที่ทราบเรียกสร้างออเดอร์โดยไม่มีหลักฐานว่าเข้าถึง QR ของโต๊ะนั้น
- แก้: แยก staff API กับ customer API หรือสร้าง customer session guard ที่ผูก QR credential กับ session; ห้ามใช้ sessionId เป็น credential; จำกัดข้อมูลตอบกลับ
- เกณฑ์ผ่าน: ไม่มี credential อ่านทุกออเดอร์ไม่ได้; credential ของโต๊ะ A อ่าน/สั่งโต๊ะ B ไม่ได้; token หมดอายุหรือ session ปิดแล้วใช้ไม่ได้

### F03 — P0: ยอดใบเสร็จเชื่อข้อมูลจาก client

- หลักฐาน: `backend/src/invoices/invoices.service.ts:41` ใช้ `dto.totalAmount` และคำนวณ `dto.totalAmount - discount`; DTO กำหนดค่าขั้นต่ำแต่ไม่มีเงื่อนไข discount ≤ totalAmount
- ผล: client กำหนดยอดเอง และยอดสุทธิอาจติดลบ; ไม่มี snapshot ราคาที่เปิด session ทำให้ควรตกลงพฤติกรรมเมื่อเปลี่ยนราคา tier ระหว่างทาน
- แก้: backend คำนวณยอดด้วยราคาที่ตกลง/บันทึกไว้และจำนวนผู้ใหญ่เด็ก ใช้ Decimal หรือหน่วยสตางค์ กำหนดสิทธิ์/เพดานส่วนลด และแยก payment confirmation จากการสร้าง QR
- เกณฑ์ผ่าน: แก้ request totalAmount แล้วลดค่าบริการไม่ได้; ปฏิเสธส่วนลดเกินยอด; ตัวอย่างทศนิยมให้ผลตรงกันใน API/UI/ใบเสร็จ

### F04 — P1: ID format ไม่ตรงกันระหว่าง API, database และ Socket

- หลักฐาน: `sessions.service.ts:171` แปลง session เป็น `ses_...`, tableId เป็น `tbl_000001`; `orders.service.ts` ใช้ dto.sessionId/query sessionId ตรงกับฐานข้อมูลโดยไม่ decode; หน้า `order/[token]/page.tsx:199` ส่ง session.id ที่ได้จาก API กลับไปตรงๆ
- อีกจุด: `SessionsService.updateStatus()` เรียก findOne ที่คืน tableId แบบ string แล้วนำ `session.tableId` ไปใช้กับ Prisma Table.id ซึ่งเป็น Int และ emit ID รูปแบบเดียวกันออกไป
- ผลที่คาดจากโค้ด: QR ordering หา session ไม่พบ/อ่านออเดอร์ว่าง และปิด session/cron expiry อาจเปลี่ยน session สำเร็จแต่เปลี่ยนโต๊ะล้มเหลว
- แก้: ตกลงรูปแบบ API ID ชัดเจน แปลงที่ boundary ให้ครบ; internal services ใช้ raw IDs; แยก display number ออกจาก primary key; event ใช้รูปแบบสม่ำเสมอ
- เกณฑ์ผ่าน: เปิดโต๊ะ → QR → สั่ง → อ่านประวัติ → ปิดโต๊ะ → cron expiry ผ่านทั้งหมด; malformed ID ได้ 400; ไม่เกิด session ปิดแต่โต๊ะค้างเพราะ ID ผิดชนิด

### F05 — P1: Schema กับ migration ไม่ครบตรงกัน

- หลักฐาน: `backend/prisma/schema.prisma` มี `User.userNumber`, `Session.sessionNumber`, `Order.orderNumber`, `Invoice.invoiceNumber` แต่ SQL migrations ทั้ง 4 ชุดไม่มีคอลัมน์เหล่านี้
- ผล: ฐานข้อมูลใหม่ที่สร้างด้วย migration ที่ commit ไว้จะขาดคอลัมน์ที่ Prisma schema คาดหวัง สถานะฐานข้อมูลจริงที่อาจเคย db push ยังไม่ทราบ
- แก้: เพิ่ม migration แบบรักษาข้อมูลเดิมและ backfill/unique/sequence ให้ถูกต้อง ไม่แก้ migration ที่ใช้งานแล้วโดยพลการ
- เกณฑ์ผ่าน: migrate deploy ลงฐานข้อมูลว่างได้ และฐานข้อมูลที่มีข้อมูลเดิมอัปเกรดได้; schema diff หลัง migration ไม่เหลือความต่างที่ไม่ได้ตั้งใจ

### F06 — P1: การสั่งอาหารไม่บังคับ tier และเวลาหมดอายุทันที

- หลักฐาน: `OrdersService.create()` ตรวจ session.status และ menu.isAvailable แต่ไม่ตรวจ tier membership หรือ endTime; หน้า QR โหลด `/menu-items` ทั้งหมด ไม่เลือกจาก tierMenuItems; `CreateOrderDto.items` ไม่มี ArrayMinSize
- ผล: เลือกเมนูนอกแพ็กเกจได้ตามโค้ด; หลัง endTime แต่ก่อน cron เปลี่ยน status ยังมีช่องสั่ง; อาจสร้างออเดอร์ไม่มีรายการ
- แก้: ตรวจ tier, เวลา server, quantity และจำนวนรายการฝั่ง backend; UI แสดงเฉพาะเมนูที่ session สั่งได้
- เกณฑ์ผ่าน: เมนูนอก tier/หมด/ไม่มีจริง, items ว่าง และ session เกินเวลาถูกปฏิเสธแม้ข้าม UI

### F07 — P0: Socket rooms ไม่ตรวจตัวตนหรือสิทธิ์

- หลักฐาน: `backend/src/events/events.gateway.ts` ยอมรับ kitchen:join/session:join จาก ID ที่ client ส่ง ไม่มี handshake authentication/authorization และใช้ CORS `*`; invoice:new และ ingredient:low_stock broadcast ทั้ง server
- ผล: client ไม่ได้รับอนุญาตสามารถขอ join room ที่ทราบ ID; ข้อมูลใบเสร็จ/ยอดและ stock ถูกส่งให้ทุก socket ที่เชื่อมต่อ
- แก้: ตรวจ staff JWT หรือ QR credential ตามชนิด client ก่อน join; ใช้ rooms ตามสิทธิ์สำหรับ event ภายใน; จำกัด origin ตาม deployment
- เกณฑ์ผ่าน: anonymous/ต่าง session/ผิดครัว join ไม่ได้; ลูกค้าไม่รับ invoice/stock ของร้าน; reconnect แล้วตรวจสิทธิ์ใหม่

### F08 — P1: QR ลูกค้าไม่ได้ join session room และมี stale state

- หลักฐาน: `frontend/src/app/order/[token]/page.tsx` ลง listener แต่ไม่มี emit `session:join`; warning handler ปิดทับค่า session จาก effect ที่ขึ้นกับ token/router; fetchData เรียก fetchOrders ทันทีหลัง setSession ซึ่งยังไม่เปลี่ยนค่าใน closure เดิม
- ผลที่คาด: ไม่ได้รับ event ที่ส่งเฉพาะ room, ประวัติครั้งแรกอาจไม่โหลด และเตือนเวลาไม่ตรง session; client emit `new-order` แต่ gateway ไม่มี handler ชื่อนี้
- แก้: join หลังมี session และ join ซ้ำเมื่อ reconnect, cleanup ด้วย handler เดิม, ใช้ dependencies หรือ explicit sessionId ให้ถูกต้อง และรับสถานะปิด session เพื่อหยุดสั่ง
- เกณฑ์ผ่าน: มือถือได้รับสถานะครัว/เวลา/ปิดโต๊ะโดยไม่ refresh และกลับมาหลังเน็ตหลุดแล้วยังตามข้อมูลทัน

### F09 — P1: Endpoint ชื่อครัวไม่ตรง และ route void logs อาจถูกจับเป็น ID

- หลักฐาน: `frontend/src/app/(dashboard)/menus/page.tsx:77` เรียก `/kitchen-sections` แต่ backend ใช้ `/kitchens`; controller orders ประกาศ `@Get(':id')` ก่อน `@Get('void-logs')`
- ผล: หน้าจัดการเมนูไม่ได้ข้อมูลครัว โดย error ถูก catch เป็นรายการว่าง; route แบบ dynamic มีความเสี่ยงรับคำว่า void-logs ไปเป็น order ID ต้องยืนยันด้วย API จริง
- แก้: ใช้ endpoint เดียวกัน/typed client; วาง static routes ก่อน dynamic routes และเพิ่ม route integration test
- เกณฑ์ผ่าน: dropdown ครัวโหลดจริงและสร้าง/แก้เมนูได้; GET /orders/void-logs เรียก handler ถูกตัว

### F10 — P1: เปิดโต๊ะและออกใบเสร็จมีความเสี่ยงเมื่อคำขอพร้อมกัน

- หลักฐาน: `SessionsService.create()` อ่าน AVAILABLE ก่อน transaction; `InvoicesService.create()` ตรวจ ACTIVE ก่อน transaction; schema ไม่กำหนด unique invoice/session หรือข้อจำกัดหนึ่ง active session ต่อโต๊ะ
- ผลที่ต้องทดสอบ: สองคำขออาจผ่านเงื่อนไขพร้อมกันและสร้าง session/ใบเสร็จซ้ำได้ แม้แต่ละ transaction จะเขียนครบชุด
- แก้: ใช้ atomic conditional update/locking/isolation และข้อจำกัดฐานข้อมูลตาม business rule; ออกแบบ idempotency สำหรับ retry
- เกณฑ์ผ่าน: concurrent เปิดโต๊ะเดียวกันสำเร็จเพียงครั้งเดียว; retry ชำระเงินไม่สร้างใบเสร็จซ้ำ; failure rollback ทั้งชุด

### F11 — P1: หมดเวลาทานแล้วอาจออกใบเสร็จไม่ได้

- หลักฐาน: cron เปลี่ยน session เป็น EXPIRED แต่ `InvoicesService.create()` รับเฉพาะ ACTIVE; `SessionsService.updateStatus()` ให้ session EXPIRED แล้วเปลี่ยนโต๊ะเป็น CLEANING ทั้งที่ยังไม่ชำระเงิน
- ผล: เมื่อ ID issue F04 ถูกแก้แล้ว workflow ยังมีช่องว่าง: ลูกค้าหมดเวลาทานแต่ยังไม่จ่ายเงิน จะต้องมีทางชำระและไม่เปิดโต๊ะรับลูกค้าใหม่ก่อนเคลียร์ยอด
- แก้: แยกสิทธิ์สั่งอาหาร เวลาทาน สถานะชำระ และสถานะโต๊ะ; ตกลง state transitions ก่อนลงมือ
- เกณฑ์ผ่าน: session หมดเวลาสั่งเพิ่มไม่ได้แต่ชำระได้; ไม่ปิดยอดซ้ำ/เปิดโต๊ะใหม่ทับยอดค้าง

### F12 — P1: QR ชำระเงินเป็นข้อความเลขโทรศัพท์

- หลักฐาน: `frontend/src/app/(dashboard)/invoices/page.tsx:537` และ `:767` ส่ง promptPayNumber เป็น value ของ QRCodeSVG โดยตรง; `SettingsService` เก็บเลขบัญชี/โทรศัพท์ใน field ของ instance ไม่ได้ persist
- ผล: ยืนยันได้ว่า QR encode เฉพาะข้อความเลขโทรศัพท์ ไม่ได้ประกอบ payload การชำระเงินพร้อมยอด; ตั้งค่าแล้วหายเมื่อ restart และแต่ละ replica อาจไม่ตรงกัน การสแกนจ่ายจริงยังไม่ได้ทดสอบ
- แก้: เลือกข้อกำหนด payment QR ที่รองรับแล้วใช้ library/ตัวสร้าง payload ที่ทดสอบได้; persist settings พร้อม DTO validation/สิทธิ์; การเห็น QR ไม่ใช่หลักฐานว่าจ่ายแล้ว
- เกณฑ์ผ่าน: ถอด QR ได้ข้อมูลผู้รับและยอดตามที่กำหนด; restart แล้วยังได้ค่าเดิม; ไม่แสดงว่ารับเงินแล้วเพียงเพราะสร้าง QR สำเร็จ

### F13 — P1: สถานะออเดอร์เปลี่ยนได้โดยไม่มีกติกาครบ

- หลักฐาน: UpdateItemStatusDto รับทุก ItemStatus รวม VOIDED; `updateItemStatus()` เปลี่ยนเป็น VOIDED ได้โดยไม่ผ่าน voidItem/สร้าง VoidLog; updateStatus(CONFIRMED) อ่าน updated.items ก่อน updateMany แล้วคืนข้อมูลเดิม และ emit PREPARING ให้ทุก item แม้ไม่ได้ถูกแก้
- ผล: audit การยกเลิกอาจไม่ครบ และ UI/event ต่างจากข้อมูลจริง; CANCELLED ยังไม่ได้จัดการสถานะรายการให้สอดคล้อง
- แก้: ระบุ allowed transitions และเงื่อนไข role ให้ชัด; void ผ่าน flow เดียว; ส่ง event จากค่าหลัง commit เฉพาะรายการที่เปลี่ยน
- เกณฑ์ผ่าน: VOIDED ทุกครั้งมีผู้อนุมัติ/เหตุผล; ย้อนสถานะที่ห้ามไม่ได้; API/event/database เห็นสถานะตรงกัน

### F14 — P2: Inventory ยังไม่มี flow ตัดตามสูตรและเสี่ยง lost update

- หลักฐาน: มี Recipe ใน schema แต่ `OrdersService` ไม่ใช้ตัด stock; `IngredientsService.adjustStock()` อ่านค่าเดิมแล้วเขียนค่าใหม่; low-stock คิด new/previous stock แทนจุดสั่งซื้อคงที่
- ผล: ปริมาณวัตถุดิบไม่ลดตามออเดอร์; ปรับพร้อมกันอาจทับกัน; การลดทีละน้อยอาจไม่เคยเตือนแม้เหลือน้อย
- แก้: ตกลงว่าจะตัดตอนรับออเดอร์/เริ่มทำ/เสิร์ฟและคืนเมื่อใด; ใช้ transaction + stock movement ledger + reorder threshold ตามหน่วยจริง
- เกณฑ์ผ่าน: ไม่ตัดซ้ำเมื่อ retry, void คืนตามกติกา, stock ไม่ติดลบ และ concurrent adjustments ไม่สูญยอด

### F15 — P2: Auth state หลายแหล่งและ refresh ไม่รวมคำขอ

- หลักฐาน: `frontend/src/stores/authStore.ts` เก็บ user/accessToken ผ่าน persisted state และ localStorage accessToken แยก key; customStorage ทำ JSON stringify/parse อีกชั้นกับ createJSONStorage; api.ts refresh แล้วอัปเดตเฉพาะ accessToken key; middleware.ts return NextResponse.next() ทุกเส้นทาง; layout ซ่อนเมนูตาม role แต่ไม่ตรวจ route permission โดยตรง
- ผลที่ต้องทดสอบ: hydrate/role/token ไม่ตรงกัน, refresh หลายคำขอแข่งกัน, มี token แต่ไม่มี user แล้ว layout ไม่ set user จาก /auth/me; route protection ฝั่ง server ยังไม่มี
- แก้: ทำ auth state แหล่งเดียว, storage adapter ตาม contract, รวม refresh ที่กำลังทำ, hydrate ผู้ใช้จาก server; ใช้ backend เป็นผู้บังคับสิทธิ์หลัก
- เกณฑ์ผ่าน: reload/หมดอายุ/หลาย API 401 พร้อมกัน/logout ผ่าน; role ใน browser ไม่ทำให้เรียก API เกินสิทธิ์

### F16 — P1: Deployment และ CI ยังไม่เป็นหลักฐานว่ารันระบบได้ครบ

- หลักฐาน: backend Docker build อาจ emit `dist/src/main.js` จาก tsconfig ที่รวม prisma/seed และ prisma.config แต่ start:prod ชี้ `dist/main`; ต้องตรวจ output หลังติดตั้งจริง; Docker backend ไม่คัดลอก prisma.config.ts ไป runner และไม่มีขั้น migrate deploy; Compose depends_on ไม่มี readiness checks
- Frontend: Docker build ไม่รับค่า NEXT_PUBLIC_* เป็น build args/ENV แต่ Compose ตั้ง API URL ตอน runtime; socket fallback เป็น localhost ซึ่งในมือถือหมายถึงมือถือเอง; main.ts กำหนด CORS เป็น local origins สองค่า
- CI: backend มีตัวอย่าง test ที่ไม่ให้ DI dependencies, e2e คาด `Hello World!` โดยไม่มี root controller ที่เกี่ยวข้อง; workflow backend auto-merge develop และลบ feature branch; frontend cache npm ไม่ระบุ lockfile ใน subfolder
- แก้: ทำ build/start/migration paths ให้ตรง, configure public URLs ตอน build หรือใช้ runtime configuration ที่ออกแบบไว้, healthchecks และ PR checks; ทบทวน auto-merge/delete ให้เป็นนโยบายที่ผู้ใช้อนุมัติแยกต่างหาก
- เกณฑ์ผ่าน: fresh clone → install → generate → migrate test DB → build → start → HTTP smoke test ได้ทั้งสองแอป; ลูกค้าใน LAN ใช้งานได้; CI ตรวจ PR โดยไม่แก้ branch เองโดยไม่ได้ตกลง

## 5. ช่องว่างการทดสอบและเอกสาร

- Backend มีไฟล์ spec จำนวนมากเป็น scaffold `should be defined`; ตัวอย่าง AuthService/OrdersService ไม่เตรียม Prisma/Jwt/Events dependencies จึงยังไม่ใช่หลักฐาน business behavior
- Backend e2e ยังเป็น starter assertion; frontend package ไม่มี unit/e2e test script
- README/SYSTEM_OVERVIEW มีข้อความว่า RBAC, middleware protection และบาง workflow พร้อมใช้งาน แต่ implementation ที่ตรวจยังไม่ครบ ควรเขียนสถานะ implemented/partial/planned ให้ชัด
- `backend` lint script มี `--fix`; รอบตรวจนี้ไม่ได้ใช้ script นี้เพื่อป้องกันการเปลี่ยน source codeระหว่าง audit
- พบการ catch API errors แล้วแทนด้วยข้อมูลว่างหลายหน้า ทำให้ผู้ใช้แยก “ยังไม่มีข้อมูล” กับ “ระบบโหลดไม่สำเร็จ” ยาก
- Compose มี default database/JWT credentials และเปิด PostgreSQL port; ต้องตั้งค่าจริงตาม deployment ก่อนใช้งาน ไม่ได้ตรวจว่าระบบจริงใช้ค่า default หรือไม่

## 6. ลำดับงานที่เสนอให้ GPT แตกเป็น prompt

| งาน | ประเด็น | ผลส่งมอบ |
|---|---|---|
| A | F04–F05, F16 เฉพาะ build/start | baseline build, ID contract, migration ที่ไม่ทำข้อมูลสูญหาย |
| B | F01–F02, F07 | permission matrix, customer credential และ REST/Socket authorization |
| C | F06, F08–F09, F13 | QR → order → KDS → status ที่ใช้งานได้จริง |
| D | F03, F10–F12 | backend pricing, invoice idempotency, overdue checkout, payment settings/QR |
| E | F14–F16 ส่วนที่เหลือ | stock ledger, auth lifecycle, deployment/CI และเอกสารตรงกับระบบ |

งาน A เป็นฐานให้ทดสอบได้ ขณะเดียวกัน F01/F02/F03/F07 ต้องแก้ก่อนเปิดให้บุคคลทั่วไปใช้ ไม่ควรตีความลำดับตารางว่าอนุญาตให้ deploy ก่อนแก้ P0

แต่ละ prompt ควรมี: issue IDs, ข้อเท็จจริงและไฟล์อ้างอิง, ขอบเขต, สิ่งที่ต้องตัดสินใจ, acceptance criteria, tests, migration/compatibility และผลสรุปที่ต้องรายงาน หลีกเลี่ยง prompt เดียวให้ rewrite ทั้งระบบ

## 7. คำถามเชิงธุรกิจที่ยังไม่มีคำตอบในโค้ด

1. ผู้ใดออกใบเสร็จ ให้ส่วนลด void และแก้บัญชีรับเงินได้บ้าง?
2. หมดเวลาทานต้องบล็อกสั่งอย่างไร มีต่อเวลา/คิดค่าปรับหรือไม่?
3. ราคายึด ณ เปิดโต๊ะหรือ ณ ชำระ? มี VAT/service charge และวิธีปัดเศษใด?
4. หนึ่ง session อนุญาตแยกบิล/ชำระหลายครั้งหรือไม่? ถ้าไม่ ให้บังคับหนึ่ง invoice ต่อ session
5. QR ชำระใช้เพียงให้พนักงานตรวจรับเงินเอง หรือเชื่อม payment provider/webhook?
6. stock ตัด/คืน ณ จุดใด และยอมให้สั่งเมื่อวัตถุดิบไม่พอหรือไม่?
7. ระบบใช้งาน LAN ร้านเดียวหรือหลายสาขา และ URL/domain/HTTPS เป้าหมายคืออะไร?

ให้ GPT ระบุสมมติฐานในแผนเสมอ อย่าแต่งกติกาเหล่านี้เป็นข้อกำหนดที่ยืนยันแล้ว
