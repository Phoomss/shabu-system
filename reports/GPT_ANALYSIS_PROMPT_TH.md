# Prompt สำหรับให้ GPT วิเคราะห์รายงานและสร้าง prompt แก้ระบบ

วิธีใช้: แนบ `SYSTEM_AUDIT_FOR_GPT_TH.md` แล้วคัดลอกข้อความต่อไปนี้ หากส่งให้ coding agent ให้แนบ repository ด้วย

```text
คุณเป็น Senior Software Architect และ Technical Lead
วิเคราะห์รายงานตรวจสอบ Shabu System ที่แนบมา เพื่อสร้างชุด prompt สำหรับ coding agent ปรับปรุงระบบเดิมทีละงาน

บริบท:
- ระบบร้านชาบู: POS, QR ordering, KDS, inventory, invoice และ admin
- Next.js/React/TypeScript frontend, NestJS backend, PostgreSQL/Prisma และ Socket.IO
- รายงานเป็น static audit พร้อมผลคำสั่งบางส่วน ไม่ใช่ผล end-to-end ที่ผ่านแล้ว
- build/test ในเครื่องตรวจติดข้อจำกัด dependencies จึงห้ามสรุปว่า errors ทั้งหมดเป็นบั๊กของ source code

สิ่งที่ต้องทำ:
1. สรุปความพร้อมของระบบ พร้อมแยกข้อเท็จจริง ความเสี่ยงจากโค้ด สมมติฐาน และสิ่งที่ยังต้องทดลอง
2. ทำตาราง issue ID, severity, impact, dependencies และลำดับแก้ โดยอ้าง F01–F16 จากรายงาน
3. ระบุคำถามเชิงธุรกิจที่ต้องตัดสินใจก่อนแก้ โดยเฉพาะสิทธิ์ ราคา ส่วนลด session หมดเวลา แยกบิล payment และ stock
4. จัดแผนงานย่อยที่ทดสอบและ review ได้ ไม่ rewrite ทั้งระบบ
5. สร้าง prompt พร้อมใช้งานแยกทีละงาน เรียงตาม dependency และมี acceptance criteria ที่พิสูจน์ได้
6. ระบุ regression test ของเส้นทางเปิดโต๊ะ → QR → สั่ง → ครัว → ชำระ → ทำความสะอาด รวม expired session, retry, concurrency และ unauthorized access

รูปแบบ prompt แต่ละงานต้องมี:
- ชื่องาน และ issue IDs ที่แก้
- เป้าหมายและพฤติกรรมก่อน/หลัง
- ไฟล์ที่ต้องอ่านก่อน และหลักฐานจากรายงาน
- ขอบเขต implementation และสิ่งที่ต้องรักษา compatibility
- สมมติฐาน/คำถามที่เกี่ยวข้อง หากไม่มีคำตอบให้เสนอทางเลือกและผลกระทบ
- ขั้นตอนตรวจ setup/dependencies ที่ต้องมี ก่อนตัดสินผล build/test
- ข้อกำหนด REST/Socket contracts และ ID format หากเกี่ยวข้อง
- migration/backfill/rollback หากเปลี่ยนฐานข้อมูล โดยห้ามลบข้อมูลจริงเพื่อให้ test ผ่าน
- acceptance criteria แบบ Given/When/Then
- tests/คำสั่งตรวจที่เหมาะกับงาน พร้อมแยก test ที่รันจริงกับยังไม่ได้รัน
- ผลสรุปที่ coding agent ต้องส่ง: ไฟล์ที่แก้ เหตุผล ผลทดสอบ ข้อจำกัด และงานคงเหลือ

ข้อจำกัด:
- หากไม่มี repository ให้ใช้ไฟล์ในรายงานเป็นจุดเริ่มตรวจ ห้ามอ้างว่าอ่านโค้ดหรือรันทดสอบเพิ่มแล้ว
- หากมี repository ต้องยืนยันหลักฐานกับโค้ดล่าสุดก่อนแก้ เพราะรายงานอาจเก่า
- การซ่อนเมนูไม่ใช่การบังคับสิทธิ์ API; ต้องตรวจ server-side authorization
- sessionId ไม่ใช่ customer credential และ QR ที่แสดงไม่ใช่หลักฐานว่ารับเงินแล้ว
- transaction ไม่เพียงพอหากตรวจ state ก่อน transaction แล้วปล่อยให้ concurrent requests ผ่านพร้อมกัน
- อย่าสร้างกติกาภาษี/ค่าปรับ/สิทธิ์/การคืน stock เองโดยไม่ระบุเป็นสมมติฐาน
- อย่าขยายขอบเขตไปอัปเกรด dependency หรือ redesign UI ทั้งหมดโดยไม่มีเหตุผลจากงาน
- ห้าม deploy, merge, ลบ branch หรือเปลี่ยนฐานข้อมูลจริงจาก prompt วิเคราะห์นี้

ส่งผลเป็นภาษาไทย โดยนำด้วยรายการปัญหาเร่งด่วน แผนงานตาม dependency แล้วตามด้วย prompt ที่คัดลอกใช้แยกงานได้
```
