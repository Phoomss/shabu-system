# 🍲 Shabu System - Backend API

## ระบบจัดการร้านอาหารชาบู / Shabu Restaurant Management System

---

## 📖 ภาพรวมระบบ / System Overview

### 🇹🇭 ภาษาไทย

ระบบ Shabu เป็นระบบจัดการร้านอาหารชาบูแบบครบวงจร พัฒนาด้วย **NestJS (TypeScript)** และใช้ฐานข้อมูล **PostgreSQL** ผ่าน **Prisma ORM** ระบบรองรับการทำงานแบบ Real-time ด้วย **Socket.IO** ทำให้สามารถอัปเดตสถานะต่างๆ ได้ทันที

### 🇬🇧 English

Shabu System is a comprehensive shabu restaurant management system built with **NestJS (TypeScript)** and using **PostgreSQL** database via **Prisma ORM**. The system supports real-time functionality with **Socket.IO**, enabling instant status updates across all modules.

---

## 🏗️ สถาปัตยกรรมระบบ / System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Clients                          │
│   (POS, Customer QR Ordering, KDS, Admin Dashboard)         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              NestJS Backend API (Port 3000)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Modules: Auth, Orders, Sessions, Tables, Inventory  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           Socket.IO Gateway (Real-time)              │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│                  (via Prisma ORM)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 ฟีเจอร์หลัก / Key Features

### 1️⃣ ระบบจัดการผู้ใช้งาน / User & Access Control

| 🇹🇭 ไทย | 🇬🇧 English |
|----------|-------------|
| จัดการบทบาทและสิทธิ์ (Role-based Access) | Role-based access control (RBAC) |
| ระบบ Authentication ด้วย JWT | JWT-based authentication |
| จัดการข้อมูลพนักงาน | Employee management |
| บันทึกกิจกรรมการทำงาน | Activity logging |

### 2️⃣ ระบบจัดการเมนูและครัว / Menu & Kitchen Management

| 🇹🇭 ไทย | 🇬🇧 English |
|----------|-------------|
| จัดการหมวดหมู่อาหาร | Food category management |
| แบ่งแผนกครัว (HOT_KITCHEN, COLD_KITCHEN) | Kitchen section separation |
| กำหนดราคาตามระดับ (Silver, Gold, Platinum) | Tier-based pricing |
| จัดการความพร้อมของเมนู | Menu availability management |

### 3️⃣ ระบบจัดการโต๊ะและรอบการนั่ง / Table & Session Management

| 🇹🇭 ไทย | 🇬🇧 English |
|----------|-------------|
| จัดการสถานะโต๊ะ (ว่าง, มีลูกค้า, จอง, ทำความสะอาด) | Table status management |
| ระบบจองโต๊ะ | Table reservation |
| กำหนดเวลาการนั่ง (Time limit per session) | Session time limits |
| สร้าง QR Token สำหรับสั่งอาหาร | QR token generation for ordering |

### 4️⃣ ระบบสั่งอาหาร / Ordering System

| 🇹🇭 ไทย | 🇬🇧 English |
|----------|-------------|
| สั่งอาหารผ่าน QR Code | QR code ordering |
| แจ้งเตือนออเดอร์ใหม่เข้าครัวแบบ Real-time | Real-time kitchen order alerts |
| ติดตามสถานะอาหาร (รอดำเนินการ, กำลังทำ, เสิร์ฟแล้ว) | Order status tracking |
| ระบบยกเลิกออเดอร์พร้อมบันทึกเหตุผล | Order voiding with reason logging |

### 5️⃣ ระบบคลังวัตถุดิบและสูตรอาหาร / Inventory & Recipe Management

| 🇹🇭 ไทย | 🇬🇧 English |
|----------|-------------|
| จัดการสต็อกวัตถุดิบ | Ingredient stock management |
| ระบบสูตรอาหาร (Recipe) | Recipe management |
| ตัดสต็อกอัตโนมัติตามสูตร | Automatic stock deduction by recipe |
| แจ้งเตือนวัตถุดิบต่ำ | Low stock alerts |

### 6️⃣ ระบบการชำระเงิน / Payment & Invoicing

| 🇹🇭 ไทย | 🇬🇧 English |
|----------|-------------|
| ออกใบเสร็จ/ใบแจ้งหนี้ | Invoice generation |
| คำนวณยอดตามระดับราคา | Tier-based billing |
| ส่วนลดและการหักส่วนลด | Discount management |
| สรุปยอดรายได้แบบ Real-time | Real-time revenue dashboard |

---

## 📂 โครงสร้างโปรเจกต์ / Project Structure

```
backend/
├── src/
│   ├── auth/              # ระบบยืนยันตัวตน / Authentication
│   ├── categories/        # หมวดหมู่สินค้า / Product categories
│   ├── common/            # ส่วนกลาง (Filters, Interceptors)
│   ├── events/            # Socket.IO Events / Real-time events
│   ├── ingredients/       # วัตถุดิบ / Ingredients
│   ├── invoices/          # ใบแจ้งหนี้ / Invoices
│   ├── kitchens/          # แผนกครัว / Kitchen sections
│   ├── menu-item/         # รายการเมนู / Menu items
│   ├── orders/            # ออเดอร์ / Orders
│   ├── prisma/            # Prisma Service
│   ├── role/              # บทบาทผู้ใช้ / User roles
│   ├── sessions/          # รอบการนั่ง / Dining sessions
│   ├── tables/            # โต๊ะ / Tables
│   ├── tiers/             # ระดับราคา / Pricing tiers
│   ├── user/              # ผู้ใช้งาน / Users
│   ├── app.module.ts      # Module หลัก / Main module
│   └── main.ts            # Entry point
├── prisma/
│   └── schema.prisma      # Database schema
├── test/                  # Tests
└── package.json
```

---

## 🛠️ เทคโนโลยีที่ใช้ / Technology Stack

| Component | Technology |
|-----------|------------|
| **Framework** | NestJS 11 |
| **Language** | TypeScript 5.7 |
| **Database** | PostgreSQL |
| **ORM** | Prisma 7.4 |
| **Authentication** | JWT + Passport |
| **Real-time** | Socket.IO 4.8 |
| **Validation** | class-validator, class-transformer |
| **Documentation** | Swagger/OpenAPI |
| **Testing** | Jest |
| **Linting** | ESLint + Prettier |

---

## 🚀 การติดตั้งและรันโปรเจกต์ / Installation & Running

### ข้อกำหนดระบบ / Requirements

- Node.js >= 18
- PostgreSQL >= 14
- npm หรือ pnpm

### ขั้นตอนการติดตั้ง / Installation Steps

```bash
# 1. ติดตั้ง Dependencies / Install dependencies
$ npm install

# 2. ตั้งค่า Environment Variables / Setup environment
$ cp .env..example .env
# แก้ไขไฟล์ .env / Edit .env file

# 3. รัน Database Migrations / Run database migrations
$ npx prisma migrate deploy

# 4. รันเซิร์ฟเวอร์ / Start server
# Development mode
$ npm run start:dev

# Production mode
$ npm run start:prod

# Debug mode
$ npm run start:debug
```

### Environment Variables / ตัวแปรสภาพแวดล้อม

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/shabu_db"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRATION="1d"

# Server
PORT=3000
```

---

## 📡 API Documentation / เอกสาร API

### Swagger UI

เมื่อรันเซิร์ฟเวอร์แล้ว สามารถเข้าถึงเอกสาร API ได้ที่:

```
http://localhost:3000/api-docs
```

### Endpoints หลัก / Main Endpoints

| Module | Endpoint | Description |
|--------|----------|-------------|
| Auth | `POST /auth/login` | เข้าสู่ระบบ / Login |
| Auth | `POST /auth/register` | ลงทะเบียน / Register |
| Users | `GET /users` | ดึงรายการผู้ใช้ / Get users |
| Tables | `GET /tables` | ดึงรายการโต๊ะ / Get tables |
| Sessions | `POST /sessions` | สร้างรอบการนั่ง / Create session |
| Orders | `POST /orders` | สร้างออเดอร์ / Create order |
| Menu Items | `GET /menu-items` | ดึงรายการเมนู / Get menu |
| Invoices | `POST /invoices` | สร้างใบแจ้งหนี้ / Create invoice |

---

## 🔔 Socket.IO Events / อีเวนต์แบบ Real-time

### Events ที่ระบบส่งออกไป / System Broadcast Events

| Event Name | Description (TH) | Description (EN) |
|------------|------------------|------------------|
| `new_order` | แจ้งเตือนออเดอร์ใหม่เข้าครัว | New order alert to kitchen |
| `order_status_update` | อัปเดตสถานะการทำอาหาร | Food preparation status update |
| `table_status_change` | เปลี่ยนสถานะโต๊ะ | Table status changed |
| `session_warning` | เตือนเวลาใกล้หมด | Session time warning |
| `session_expired` | แจ้งเวลาหมดแล้ว | Session expired |
| `invoice_created` | แจ้งยอดชำระเงินใหม่ | New invoice created |
| `low_stock_alert` | เตือนวัตถุดิบใกล้หมด | Low ingredient stock alert |
| `void_request` | แจ้งขอ-cancel ออเดอร์ | Order void request alert |

---

## 🧪 การทดสอบ / Testing

```bash
# Unit tests / ยูนิตเทส
$ npm run test

# E2E tests / เทสระบบรวม
$ npm run test:e2e

# Test coverage / ความครอบคลุมเทส
$ npm run test:cov
```

---

## 📝 Database Schema Overview / ภาพรวมฐานข้อมูล

### กลุ่มตาราง / Table Groups

1. **User & Access Control** - จัดการผู้ใช้และสิทธิ์
   - `Role`, `User`

2. **Menu & Kitchen** - เมนูและแผนกครัว
   - `KitchenSection`, `Category`, `Tier`, `MenuItem`, `TierMenuItem`

3. **Table & Session** - โต๊ะและรอบการนั่ง
   - `Table`, `Session`

4. **Ordering** - ระบบสั่งอาหาร
   - `Order`, `OrderItem`

5. **Inventory & Finance** - คลังและบัญชี
   - `Ingredient`, `Recipe`, `Invoice`, `VoidLog`

---

## 🔐 Security Features / ฟีเจอร์ความปลอดภัย

- ✅ JWT Authentication
- ✅ Role-based Access Control (RBAC)
- ✅ Password Hashing (bcrypt)
- ✅ Input Validation (class-validator)
- ✅ Whitelist DTO Transformation
- ✅ Refresh Token Support
- ✅ Void Log Audit Trail

---

## 📊 Real-time Features / ฟีเจอร์แบบ Real-time

ระบบใช้ **Socket.IO** สำหรับการสื่อสารแบบสองทาง (Bi-directional) ระหว่าง:

- **ลูกค้า** ↔ **ระบบ** (ผ่าน QR Ordering)
- **ครัว** ↔ **ระบบ** (ผ่าน KDS - Kitchen Display System)
- **พนักงาน** ↔ **ระบบ** (ผ่าน POS)
- **ผู้บริหาร** ↔ **ระบบ** (ผ่าน Dashboard)

---

## 🎨 Response Format / รูปแบบการตอบกลับ

```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

---

## 📞 Support / การสนับสนุน

สำหรับคำถามหรือปัญหาในการใช้งาน:

- 📧 Email: [ติดต่อทีมพัฒนา / Contact dev team]
- 📖 Documentation: `/api-docs`
- 🐛 Issues: [GitHub Issues]

---

## 📄 License / ใบอนุญาต

UNLICENSED - © Shabu System. All rights reserved.

---

## 🙏 Acknowledgments / ขอบคุณ

Built with ❤️ using:
- [NestJS](https://nestjs.com/)
- [Prisma](https://www.prisma.io/)
- [Socket.IO](https://socket.io/)
- [PostgreSQL](https://www.postgresql.org/)

---

<div align="center">

**🍲 Shabu System - Backend API**

*ระบบจัดการร้านอาหารชาบูแบบครบวงจร | Comprehensive Shabu Restaurant Management System*

---

Made with TypeScript & NestJS

</div>
