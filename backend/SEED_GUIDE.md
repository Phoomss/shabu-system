# 🌱 Seed Data Guide

For login accounts only, use the repeatable `npm run seed:demo-users` command described in [Demo users](../DEMO_USERS.md). The full seed below also inserts restaurant sample data and can be run again without duplicating its records.

## Visitor showcase setup

`docker compose up -d --build` starts PostgreSQL, waits until it is ready, applies migrations, ensures the catalog and visitor examples exist, then starts the backend and frontend. Existing restaurant records and edits are retained.

From the repository root:

```bash
docker compose up -d --build
```

Open `http://localhost:3001/login`. The four demo users are `demo_owner`, `demo_manager`, `demo_staff`, and `demo_kitchen`. The default password is `demo12345`, and the login page fills it when a demo account is selected. This default is for a disposable local demo. To change it, set `DEMO_USER_PASSWORD` in a root `.env` file before running the same Docker command; Compose uses it for both the accounts and the login page.

See [Demo users](../DEMO_USERS.md) for role access. On a fresh database, the original eight sample accounts also use the chosen password. Each setup run sets the password and role for the four demo accounts; it leaves existing non-demo accounts alone. If setup fails, inspect `docker compose logs setup`.

Run this only against a disposable demo database. The command can be run again: existing scenario sessions and their later edits are skipped.

## Test scenarios

After running the full seed on a fresh database, add operational test data:

```bash
cd backend
npm run seed:test-data
```

This adds 11 sessions, 12 orders, five invoices, and two void logs using the existing menu, tiers, tables, and `manager` account:

| Table | State | Test flow |
| --- | --- | --- |
| A2 | Occupied, Gold | Confirmed order with preparing, pending, and served items |
| A3 | Occupied, Silver | Pending order to confirm from POS or kitchen |
| A4 | Cleaning, Platinum | Closed session, cash invoice, and a voided item with an approval log |
| A5 | Occupied, Gold | Cancelled order and replacement order |
| A6 | Occupied, Premium | Bar, dessert, and hot kitchen items |
| B1–B4 | Available | Paid sessions from the previous four days, with varied payment methods |
| C1 | Occupied, Premium | VIP table with a pending order |
| OUT1 | Cleaning, Silver | Expired outdoor session |

Open `/order/test-data-active-kitchen-a2` to test customer ordering. Re-running the command skips scenarios already present, so later changes to those orders are preserved. It skips a scenario table that is already occupied by other data. It requires `DATABASE_URL` and does not create or change login passwords.

The base `npm run seed` command can be rerun to fill missing restaurant catalog records without duplicating existing ones. Compose runs it automatically.

## ✅ Seed Completed Successfully!

The database has been seeded with comprehensive test data for the Shabu Restaurant Management System.

---

## 📊 Seeded Data Summary

| Entity | Count | Description |
|--------|-------|-------------|
| **Roles** | 4 | OWNER, MANAGER, STAFF, KITCHEN |
| **Users** | 8 | Test users for all roles |
| **Kitchen Sections** | 4 | HOT_KITCHEN, COLD_KITCHEN, BAR, DESSERT |
| **Categories** | 10 | Food categories (Beef, Pork, Seafood, etc.) |
| **Tiers** | 4 | Silver, Gold, Platinum, Premium |
| **Menu Items** | 56 | Complete menu with images |
| **Tables** | 28 | 4 zones (A, B, C-VIP, Outdoor) |
| **Ingredients** | 16 | Stock items with quantities |
| **Recipes** | 10 | Menu item recipes |
| **Sessions** | 1 | Sample active session |
| **Orders** | 1 | Sample order with items |

---

## 🔐 Test Credentials

All users have the password: **`admin123`**

| Username | Role | Description |
|----------|------|-------------|
| `admin` | OWNER | System administrator |
| `manager` | MANAGER | Restaurant manager |
| `somchai` | MANAGER | Additional manager |
| `staff` | STAFF | Regular staff |
| `somsri` | STAFF | Additional staff |
| `witree` | STAFF | Additional staff |
| `kitchen` | KITCHEN | Kitchen staff |
| `chef1` | KITCHEN | Additional chef |

---

## 💎 Pricing Tiers

| Tier | Adult | Child | Time Limit | Menu Access |
|------|-------|-------|------------|-------------|
| **Silver** | 399฿ | 199฿ | 90 min | Basic items (30) |
| **Gold** | 599฿ | 299฿ | 120 min | Standard + (45) |
| **Platinum** | 799฿ | 399฿ | 150 min | Premium + (55) |
| **Premium** | 999฿ | 499฿ | 180 min | All items (56) |

---

## 🪑 Table Layout

### Zone A (10 tables)
- Tables: A1 - A10
- Standard seating area

### Zone B (8 tables)
- Tables: B1 - B8
- Standard seating area

### Zone C - VIP (6 tables)
- Tables: C1 - C6
- VIP seating area

### Outdoor (4 tables)
- Tables: OUT1 - OUT4
- Outdoor seating area

**Total: 28 tables**

---

## 🍽️ Menu Categories

1. **เนื้อวัว** (Beef) - 4 items
2. **เนื้อหมู** (Pork) - 3 items
3. **อาหารทะเล** (Seafood) - 4 items
4. **ลูกชิ้น** (Meatballs) - 5 items
5. **ผัก** (Vegetables) - 10 items
6. **เส้น** (Noodles) - 7 items
7. **ไข่** (Eggs) - 3 items
8. **ขนมหวาน** (Desserts) - 8 items
9. **เครื่องดื่ม** (Drinks) - 8 items
10. **น้ำจิ้ม** (Sauces) - 5 items

**Total: 56 menu items**

---

## 👨‍🍳 Kitchen Sections

| Section | Responsibilities |
|---------|------------------|
| **HOT_KITCHEN** | Hot dishes, grilled items, cooked food |
| **COLD_KITCHEN** | Vegetables, noodles, cold preparations |
| **BAR** | Beverages, drinks |
| **DESSERT** | Desserts, ice cream, sweets |

---

## 📦 Sample Ingredients

| Ingredient | Unit | Initial Stock |
|------------|------|---------------|
| เนื้อวัว (Beef) | kg | 50 |
| เนื้อหมู (Pork) | kg | 40 |
| กุ้ง (Shrimp) | kg | 25 |
| ปลาหมึก (Squid) | kg | 20 |
| ผักบุ้ง (Morning Glory) | kg | 30 |
| ผักกาดขาว (Cabbage) | kg | 35 |
| เห็ดเข็มทอง (Enoki) | kg | 15 |
| วุ้นเส้น (Glass Noodles) | kg | 20 |
| บะหมี่ไข่ (Egg Noodles) | kg | 25 |
| ไข่ไก่ (Eggs) | ฟอง | 200 |
| เต้าหู้ (Tofu) | ชิ้น | 100 |
| ไอศกรีม (Ice Cream) | ถ้วย | 50 |
| น้ำอัดลม (Soft Drinks) | กระป๋อง | 100 |
| น้ำเปล่า (Water) | ขวด | 200 |
| ซอสพริก (Chili Sauce) | ขวด | 30 |
| ซอสมะเขือเทศ (Ketchup) | ขวด | 25 |

---

## 📋 Sample Data

### Active Session
- **Table:** A1
- **Tier:** Gold
- **Status:** ACTIVE
- **QR Token:** Generated

### Sample Order
- **Status:** CONFIRMED
- **Items:**
  - 2x เนื้อวัวพรีเมียม (SERVED)
  - 2x เนื้อหมูหมัก (SERVED)
  - 1x ผักบุ้ง (SERVED)
  - 1x วุ้นเส้น (SERVED)

---

## 🚀 How to Run Seed

```bash
cd backend
npm run seed
```

Or using Prisma directly:
```bash
npx prisma db seed
```

---

## 🔄 Reset Database

To reset and re-seed the database:

```bash
# Reset database (WARNING: Deletes all data)
npx prisma migrate reset

# Or manually delete and recreate
npx prisma db push --force-reset
npm run seed
```

---

## 📝 Notes

- All menu items are marked as `isAvailable: true` by default
- A1 is `OCCUPIED` for the sample active session; other tables start `AVAILABLE`
- All users have `isActive: true`
- Password for all test users: `admin123`
- Sample session is set to expire 2 hours from creation

---

## 🎯 Testing Scenarios

### POS Testing
1. Login as `staff` / `admin123`
2. Go to POS page
3. Select available table (A2-A28)
4. Add menu items to cart
5. Checkout to create session and order

### KDS Testing
1. Login as `kitchen` / `admin123`
2. Go to KDS page
3. View incoming orders from POS
4. Update order item status (PENDING → PREPARING → SERVED)

### Customer Ordering Testing
1. Create session via POS or use existing sample session
2. Get QR token from Sessions page
3. Navigate to `/order/{token}`
4. Browse menu and place orders

### Management Testing
1. Login as `admin` / `admin123`
2. Access Dashboard for analytics
3. Manage users, roles, menu items
4. View invoices and void logs

---

**Database:** PostgreSQL  
**Prisma Version:** 7.4.2
