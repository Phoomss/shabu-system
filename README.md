# 🍲 Shabu System - Complete System Overview

## ระบบจัดการร้านอาหารชาบูแบบครบวงจร / Comprehensive Shabu Restaurant Management System

---

## 📖 ภาพรวมระบบ / System Overview

### 🇹🇭 ภาษาไทย

ระบบ Shabu เป็นระบบจัดการร้านอาหารชาบูแบบครบวงจรที่พัฒนาด้วยสถาปัตยกรรม **Full-Stack Modern Web Application** ประกอบด้วย:

- **Frontend**: พัฒนาด้วย **Next.js 16 (App Router)** และ **React 19** ใช้ **TypeScript** เป็นหลัก
- **Backend**: พัฒนาด้วย **NestJS (TypeScript)** และใช้ฐานข้อมูล **PostgreSQL** ผ่าน **Prisma ORM**
- **Real-time Communication**: ใช้ **Socket.IO** สำหรับการสื่อสารแบบสองทางระหว่าง Client และ Server

ระบบรองรับการทำงานหลายรูปแบบ: POS (Point of Sale), KDS (Kitchen Display System), ระบบสั่งอาหารผ่าน QR Code และ Admin Dashboard สำหรับจัดการหลังบ้าน

### 🇬🇧 English

Shabu System is a comprehensive shabu restaurant management system built with a **Full-Stack Modern Web Application** architecture consisting of:

- **Frontend**: Built with **Next.js 16 (App Router)** and **React 19**, primarily using **TypeScript**
- **Backend**: Built with **NestJS (TypeScript)** and using **PostgreSQL** database via **Prisma ORM**
- **Real-time Communication**: Uses **Socket.IO** for bi-directional communication between Client and Server

The system supports multiple operations: POS (Point of Sale), KDS (Kitchen Display System), QR Code Ordering, and Admin Dashboard for back-office management.

---

## 🏗️ สถาปัตยกรรมระบบ / System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Client Devices                                       │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │
│   │    POS      │  │    KDS      │  │   Customer  │  │   Admin     │       │
│   │  (Tablet)   │  │  (Kitchen)  │  │  (Mobile)   │  │  (Desktop)  │       │
│   └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────────────────────────────────────────┘
         │                   │                   │                   │
         └───────────────────┴───────────────────┴───────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Frontend - Next.js 16 (Port 3001)                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  App Router (Server & Client Components)                            │   │
│  │  - (auth)/login          → Authentication                           │   │
│  │  - (dashboard)/*         → Admin Dashboard Modules                  │   │
│  │  - /order/[token]        → Customer QR Ordering                     │   │
│  │  - /pos                  → Point of Sale                            │   │
│  │  - /kds                  → Kitchen Display System                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  State Management: Zustand + TanStack React Query                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  UI: Tailwind CSS 4 + shadcn/ui (Radix UI) + Lucide Icons           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
         │                                                           │
         │ HTTP/REST (Axios)                                         │ WebSocket (Socket.IO)
         ▼                                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   Backend - NestJS 11 (Port 3000)                           │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  REST API Endpoints                                                 │   │
│  │  - /auth       → Authentication & Authorization                     │   │
│  │  - /users      → User Management                                    │   │
│  │  - /tables     → Table Management                                   │   │
│  │  - /sessions   → Session Management                                 │   │
│  │  - /orders     → Order Management                                   │   │
│  │  - /menu-items → Menu Management                                    │   │
│  │  - /invoices   → Invoice & Payment                                  │   │
│  │  - /ingredients→ Inventory Management                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Socket.IO Gateway (Real-time Events)                               │   │
│  │  - new_order, order_status_update, table_status_change              │   │
│  │  - session_warning, low_stock_alert, void_request                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Prisma ORM + PostgreSQL Database                                   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PostgreSQL Database                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Tables: Role, User, Table, Session, Order, OrderItem               │   │
│  │  MenuItem, Category, Tier, KitchenSection, TierMenuItem             │   │
│  │  Ingredient, Recipe, Invoice, VoidLog                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
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

**Roles:**
- **OWNER** - เจ้าของระบบ (Full access)
- **MANAGER** - ผู้จัดการ (Management access)
- **STAFF** - พนักงานทั่วไป (POS, Orders)
- **KITCHEN** - พนักงานครัว (KDS only)

---

### 2️⃣ ระบบจัดการเมนูและครัว / Menu & Kitchen Management

| 🇹🇭 ไทย | 🇬🇧 English |
|----------|-------------|
| จัดการหมวดหมู่อาหาร | Food category management |
| แบ่งแผนกครัว (HOT_KITCHEN, COLD_KITCHEN, BAR, DESSERT) | Kitchen section separation |
| กำหนดราคาตามระดับ (Silver, Gold, Platinum, Premium) | Tier-based pricing |
| จัดการความพร้อมของเมนู | Menu availability management |

**Kitchen Sections:**
- **HOT_KITCHEN** - อาหารร้อน, ย่าง, ทอด
- **COLD_KITCHEN** - ผัก, เส้น, อาหารเย็น
- **BAR** - เครื่องดื่ม
- **DESSERT** - ขนมหวาน, ไอศกรีม

---

### 3️⃣ ระบบจัดการโต๊ะและรอบการนั่ง / Table & Session Management

| 🇹🇭 ไทย | 🇬🇧 English |
|----------|-------------|
| จัดการสถานะโต๊ะ (ว่าง, มีลูกค้า, จอง, ทำความสะอาด) | Table status management |
| ระบบจองโต๊ะ | Table reservation |
| กำหนดเวลาการนั่ง (Time limit per session) | Session time limits |
| สร้าง QR Token สำหรับสั่งอาหาร | QR token generation for ordering |

**Table Status:**
- `AVAILABLE` - ว่าง
- `OCCUPIED` - มีลูกค้านั่งอยู่
- `RESERVED` - จองแล้ว
- `CLEANING` - รอทำความสะอาด

**Session Status:**
- `ACTIVE` - กำลังทานอยู่
- `CLOSED` - ปิดโต๊ะแล้ว
- `EXPIRED` - หมดเวลา

---

### 4️⃣ ระบบสั่งอาหาร / Ordering System

| 🇹🇭 ไทย | 🇬🇧 English |
|----------|-------------|
| สั่งอาหารผ่าน QR Code | QR code ordering |
| สั่งอาหารผ่าน POS | POS ordering |
| แจ้งเตือนออเดอร์ใหม่เข้าครัวแบบ Real-time | Real-time kitchen order alerts |
| ติดตามสถานะอาหาร (รอดำเนินการ, กำลังทำ, เสิร์ฟแล้ว) | Order status tracking |
| ระบบยกเลิกออเดอร์พร้อมบันทึกเหตุผล | Order voiding with reason logging |

**Order Status:**
- `PENDING` - รอยืนยัน
- `CONFIRMED` - ยืนยันแล้ว
- `CANCELLED` - ยกเลิก

**Item Status:**
- `PENDING` - รอดำเนินการ
- `PREPARING` - กำลังทำ
- `SERVED` - เสิร์ฟแล้ว
- `VOIDED` - ยกเลิก

---

### 5️⃣ ระบบคลังวัตถุดิบและสูตรอาหาร / Inventory & Recipe Management

| 🇹🇭 ไทย | 🇬🇧 English |
|----------|-------------|
| จัดการสต็อกวัตถุดิบ | Ingredient stock management |
| ระบบสูตรอาหาร (Recipe) | Recipe management |
| ตัดสต็อกอัตโนมัติตามสูตร | Automatic stock deduction by recipe |
| แจ้งเตือนวัตถุดิบต่ำ | Low stock alerts |

---

### 6️⃣ ระบบการชำระเงิน / Payment & Invoicing

| 🇹🇭 ไทย | 🇬🇧 English |
|----------|-------------|
| ออกใบเสร็จ/ใบแจ้งหนี้ | Invoice generation |
| คำนวณยอดตามระดับราคา | Tier-based billing |
| ส่วนลดและการหักส่วนลด | Discount management |
| รองรับหลายช่องทางชำระเงิน | Multiple payment methods |
| สรุปยอดรายได้แบบ Real-time | Real-time revenue dashboard |

**Payment Methods:**
- `CASH` - เงินสด
- `CREDIT_CARD` - บัตรเครดิต
- `DEBIT_CARD` - บัตรเดบิต
- `QR_CODE` - PromptPay QR
- `BANK_TRANSFER` - โอนเงิน

---

### 7️⃣ ระบบตั้งค่าร้าน / Restaurant Settings

| 🇹🇭 ไทย | 🇬🇧 English |
|----------|-------------|
| จัดการข้อมูลร้าน (ชื่อ, ที่อยู่, โลโก้) | Restaurant info management |
| ตั้งค่าระบบทั่วไป | General system configuration |
| ตั้งค่าเวลาเปิด-ปิด | Opening hours configuration |
| ตั้งค่าภาษีและบริการ | Tax and service charge settings |

---

## 📂 โครงสร้างโปรเจกต์ / Project Structure

```
shabu-system/
├── backend/                          # NestJS Backend API
│   ├── src/
│   │   ├── auth/                     # Authentication module
│   │   ├── categories/               # Food categories
│   │   ├── common/                   # Filters, Interceptors, Guards
│   │   ├── events/                   # Socket.IO Gateway
│   │   ├── ingredients/              # Ingredient management
│   │   ├── invoices/                 # Invoice management
│   │   ├── kitchens/                 # Kitchen sections
│   │   ├── menu-item/                # Menu items
│   │   ├── orders/                   # Order management
│   │   ├── prisma/                   # Prisma service
│   │   ├── role/                     # User roles
│   │   ├── sessions/                 # Dining sessions
│   │   ├── settings/                 # Restaurant settings
│   │   ├── tables/                   # Table management
│   │   ├── tiers/                    # Pricing tiers
│   │   ├── user/                     # User management
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma             # Database schema
│   │   └── seed.ts                   # Seed data script
│   ├── test/                         # E2E tests
│   ├── .env..example
│   ├── package.json
│   ├── tsconfig.json
│   └── SEED_GUIDE.md
│
├── frontend/                         # Next.js Frontend
│   ├── src/
│   │   ├── app/                      # Next.js App Router
│   │   │   ├── (auth)/               # Auth pages
│   │   │   │   └── login/
│   │   │   ├── (dashboard)/          # Dashboard pages
│   │   │   │   ├── dashboard/
│   │   │   │   ├── pos/
│   │   │   │   ├── kds/
│   │   │   │   ├── users/
│   │   │   │   ├── tables/
│   │   │   │   ├── sessions/
│   │   │   │   ├── menus/
│   │   │   │   ├── categories/
│   │   │   │   ├── tiers/
│   │   │   │   ├── kitchen-sections/
│   │   │   │   ├── ingredients/
│   │   │   │   ├── orders/
│   │   │   │   ├── invoices/
│   │   │   │   └── void-logs/
│   │   │   ├── order/                # Customer ordering
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn components
│   │   │   ├── pos/                  # POS components
│   │   │   └── providers/            # Context providers
│   │   ├── lib/
│   │   │   ├── api.ts                # Axios client
│   │   │   ├── socket.ts             # Socket.IO client
│   │   │   └── utils.ts
│   │   ├── stores/
│   │   │   ├── authStore.ts          # Auth state
│   │   │   └── cartStore.tsx         # Cart state
│   │   ├── types/
│   │   │   └── index.ts              # TypeScript types
│   │   └── middleware.ts             # Auth middleware
│   ├── public/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   └── SYSTEM_OVERVIEW.md
│
└── README.md
```

---

## 🛠️ เทคโนโลยีที่ใช้ / Technology Stack

### Backend Technologies

| Component | Technology | Version |
|-----------|------------|---------|
| **Framework** | NestJS | 11.x |
| **Language** | TypeScript | 5.7 |
| **Database** | PostgreSQL | Latest |
| **ORM** | Prisma | 7.4 |
| **Authentication** | JWT + Passport | Latest |
| **Real-time** | Socket.IO | 4.8 |
| **Validation** | class-validator, class-transformer | Latest |
| **Documentation** | Swagger/OpenAPI | Latest |
| **Testing** | Jest | 30.x |

### Frontend Technologies

| Component | Technology | Version |
|-----------|------------|---------|
| **Framework** | Next.js | 16.2 |
| **React** | React | 19.2 |
| **Language** | TypeScript | 5.x |
| **Styling** | Tailwind CSS | 4.x |
| **UI Components** | Radix UI + shadcn | Latest |
| **Icons** | Lucide React | 0.577 |
| **State Management** | Zustand | 5.0 |
| **Data Fetching** | TanStack React Query | 5.94 |
| **HTTP Client** | Axios | 1.13 |
| **Real-time** | Socket.IO Client | 4.8 |
| **Forms** | React Hook Form | 7.72 |
| **Validation** | Zod | 4.3 |
| **QR Code** | qrcode.react | 4.2 |
| **Notifications** | Sonner | 2.0 |
| **Theming** | next-themes | 0.4 |

---

## 🚀 การติดตั้งและรันโปรเจกต์ / Installation & Running

### ข้อกำหนดระบบ / Requirements

- Node.js >= 18
- PostgreSQL >= 14
- npm หรือ pnpm

### ขั้นตอนการติดตั้ง / Installation Steps

```bash
# ==================== BACKEND ====================
cd backend

# 1. ติดตั้ง Dependencies
npm install

# 2. ตั้งค่า Environment Variables
cp .env..example .env
# แก้ไขไฟล์ .env ให้ถูกต้อง

# 3. รัน Database Migrations
npx prisma migrate deploy

# 4. รัน Seed Data (Optional)
npm run seed

# หรือสร้างเฉพาะบัญชีสาธิต (ดู DEMO_USERS.md)
# ตั้งค่า DEMO_USER_PASSWORD ก่อน แล้วรัน:
npm run seed:demo-users

# 5. รัน Backend Server
npm run start:dev


# ==================== FRONTEND ====================
cd frontend

# 1. ติดตั้ง Dependencies
npm install

# 2. ตั้งค่า Environment Variables
# สร้างไฟล์ .env.local:
# NEXT_PUBLIC_API_URL=http://localhost:3000
# NEXT_PUBLIC_SOCKET_URL=http://localhost:3000

# 3. รัน Frontend Server
npm run dev
```

Demo account setup and sign-in details: [DEMO_USERS.md](DEMO_USERS.md).

### Environment Variables

#### Backend (.env)
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/shabu_db"

# JWT
JWT_SECRET="your-secret-key"
JWT_EXPIRATION="1d"

# Server
PORT=3000
```

#### Frontend (.env.local)
```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# Socket.IO Configuration
NEXT_PUBLIC_SOCKET_URL=http://localhost:3000
```

---

## 📡 API Documentation / API Documentation

### Backend Swagger UI

เมื่อรัน Backend Server แล้ว สามารถเข้าถึงเอกสาร API ได้ที่:

```
http://localhost:3000/api-docs
```

### Main Endpoints

| Module | Endpoint | Method | Description |
|--------|----------|--------|-------------|
| Auth | `/auth/login` | POST | เข้าสู่ระบบ / Login |
| Auth | `/auth/register` | POST | ลงทะเบียน / Register |
| Users | `/users` | GET/POST/PUT/DELETE | จัดการผู้ใช้ / User CRUD |
| Tables | `/tables` | GET/POST/PUT/DELETE | จัดการโต๊ะ / Table CRUD |
| Sessions | `/sessions` | GET/POST/PUT/DELETE | จัดการรอบการนั่ง / Session CRUD |
| Orders | `/orders` | GET/POST/PUT | จัดการออเดอร์ / Order management |
| Menu Items | `/menu-items` | GET/POST/PUT/DELETE | จัดการเมนู / Menu CRUD |
| Invoices | `/invoices` | GET/POST | จัดการใบแจ้งหนี้ / Invoice management |
| Ingredients | `/ingredients` | GET/POST/PUT/DELETE | จัดการวัตถุดิบ / Ingredient CRUD |
| Settings | `/settings` | GET/PATCH | ตั้งค่าร้าน / Restaurant settings |

---

## 🔔 Socket.IO Events / Real-time Events

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `kitchen:join` | `{ kitchenId: number }` | Join kitchen room |
| `session:join` | `{ sessionId: string }` | Join session room |
| `update-order-item` | `{ orderItemId, status }` | Update order item status |
| `new-order` | `{ sessionId, items }` | Create new order |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `menu:availability_changed` | `{ menuItemId, isAvailable, name }` | Menu availability changed |
| `kitchen:new_order` | `{ orderId, sessionId, items }` | New order in kitchen |
| `kitchen:void_order` | `{ orderItemId, orderId, reason }` | Order voided |
| `order:status_changed` | `Order` | Order status updated |
| `order:item_status_changed` | `{ orderItemId, orderId, menuItem, kitchen, status }` | Item status updated |
| `table:status_changed` | `{ tableId, status }` | Table status changed |
| `session:status_changed` | `{ sessionId, status }` | Session status changed |
| `session:time_warning` | `{ sessionId, minutesLeft }` | Session time warning |
| `ingredient:low_stock` | `{ ingredientId, name, currentStock, unit, isEmpty }` | Low stock alert |
| `invoice:new` | `{ invoiceId, netAmount, paymentMethod, tableNumber }` | New invoice created |

---

## 🗄️ Database Schema Overview

### Entity Groups

1. **User & Access Control**
   - `Role` - บทบาทผู้ใช้งาน
   - `User` - ข้อมูลผู้ใช้งาน

2. **Menu & Kitchen Configuration**
   - `KitchenSection` - แผนกครัว
   - `Category` - หมวดหมู่อาหาร
   - `Tier` - ระดับราคา
   - `MenuItem` - รายการเมนู
   - `TierMenuItem` - ความสัมพันธ์ Tier-Menu

3. **Table & Session Management**
   - `Table` - ข้อมูลโต๊ะ
   - `Session` - รอบการนั่ง

4. **Ordering System**
   - `Order` - หัวข้อออเดอร์
   - `OrderItem` - รายการอาหารในออเดอร์

5. **Inventory & Finance**
   - `Ingredient` - วัตถุดิบ
   - `Recipe` - สูตรอาหาร
   - `Invoice` - ใบแจ้งหนี้
   - `VoidLog` - บันทึกการยกเลิก

---

## 🔐 Security Features

- ✅ JWT Authentication
- ✅ Role-based Access Control (RBAC)
- ✅ Password Hashing (bcrypt)
- ✅ Input Validation (class-validator)
- ✅ Whitelist DTO Transformation
- ✅ Refresh Token Support
- ✅ Void Log Audit Trail
- ✅ CORS Configuration
- ✅ Middleware Protection (Frontend)

---

## 📱 Application Pages

### Public Pages

| Page | Route | Description |
|------|-------|-------------|
| Login | `/login` | Authentication page |
| Customer Ordering | `/order/[token]` | QR code ordering page |

### Protected Pages (Dashboard)

| Page | Route | Primary Role |
|------|-------|--------------|
| Dashboard | `/dashboard` | All users |
| POS | `/pos` | STAFF, MANAGER, OWNER |
| KDS | `/kds` | KITCHEN, MANAGER, OWNER |
| Users | `/users` | MANAGER, OWNER |
| Tables | `/tables` | MANAGER, OWNER |
| Sessions | `/sessions` | MANAGER, OWNER |
| Menus | `/menus` | MANAGER, OWNER |
| Categories | `/categories` | MANAGER, OWNER |
| Tiers | `/tiers` | MANAGER, OWNER |
| Kitchen Sections | `/kitchen-sections` | MANAGER, OWNER |
| Ingredients | `/ingredients` | MANAGER, OWNER |
| Orders | `/orders` | MANAGER, OWNER |
| Invoices | `/invoices` | MANAGER, OWNER |
| Void Logs | `/void-logs` | MANAGER, OWNER |
| Roles | `/roles` | OWNER only |

---

## 🧪 Testing

### Backend Testing

```bash
cd backend

# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

### Frontend Testing

```bash
cd frontend

# Linting
npm run lint

# (Future) Unit tests
# (Future) E2E tests
```

---

## 🔄 Development Workflow

### Adding a New Feature

1. **Backend:**
   - Create module with NestJS CLI: `nest g module <module-name>`
   - Define Prisma schema and run migration
   - Create DTOs, Controller, Service
   - Add Swagger decorators
   - Test with Postman/Swagger

2. **Frontend:**
   - Create new route in `src/app/`
   - Add API service in `src/lib/`
   - Define types in `src/types/`
   - Create components in `src/components/`
   - Add state management if needed
   - Test with backend API

---

## 📞 Support / การสนับสนุน

สำหรับคำถามหรือปัญหาในการใช้งาน:

- 📧 Email: [ติดต่อทีมพัฒนา / Contact dev team]
- 📖 Backend API Docs: `http://localhost:3000/api-docs`
- 🐛 Issues: [GitHub Issues]

---

## 📄 License / ใบอนุญาต

UNLICENSED - © Shabu System. All rights reserved.

---

## 🙏 Acknowledgments / ขอบคุณ

Built with ❤️ using:

**Backend:**
- [NestJS](https://nestjs.com/)
- [Prisma](https://www.prisma.io/)
- [Socket.IO](https://socket.io/)
- [PostgreSQL](https://www.postgresql.org/)

**Frontend:**
- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [TanStack Query](https://tanstack.com/query)

---

<div align="center">

**🍲 Shabu System - Complete System Overview**

*ระบบจัดการร้านอาหารชาบูแบบครบวงจร | Comprehensive Shabu Restaurant Management System*

---

**Backend:** NestJS + Prisma + PostgreSQL  
**Frontend:** Next.js 16 + React 19 + TypeScript  
**Real-time:** Socket.IO

---

Made with TypeScript & ❤️

</div>
