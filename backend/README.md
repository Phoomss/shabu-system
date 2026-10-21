# Shabu backend

NestJS + Prisma 7 / PostgreSQL; ใช้ Node.js 22.12+ และ npm ci ตาม lockfile

เอกสาร setup, environment, Docker, LAN/CORS, migration/seed และสถานะ implemented/partial/planned อยู่ใน [README หลัก](../README.md) และ [รายงาน F15/F16](../reports/F15_F16_AUTH_RUNTIME_CI_TH.md)

```sh
npm ci
npm run prisma:generate
npm run migrate:deploy
npm run build
npm run start:prod
```

เตรียม private `.env` จาก `.env.example` และตรวจ DATABASE_URL ก่อน migrate; ไม่มี seed/reset อัตโนมัติ `start:prod` ใช้ `dist/main.js` และ `register-paths.cjs` ส่วน `/health` ตรวจ DB readiness ไม่ใช่การอนุญาต staff APIs

Authorization เป็น default-deny แม้ OWNER; grants/assignments ต้องผ่านการอนุมัติ ไม่ใช้ demo seed สำหรับ production

```sh
npm run test:regression
npm run lint
npm test -- --runInBand
```

Regression suites ที่ระบุผ่านตามรายงาน แต่ full-repo lint และ scaffold tests เดิมยังเป็น source blockers ซึ่ง CI จะบล็อกไว้
