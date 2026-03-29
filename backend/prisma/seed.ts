import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  console.log('🌱 Starting database seed...\n');

  // ==================== 1. ROLES ====================
  console.log('📋 Creating roles...');
  const roles = await Promise.all([
    prisma.role.upsert({ where: { name: 'OWNER' }, update: {}, create: { name: 'OWNER' } }),
    prisma.role.upsert({ where: { name: 'MANAGER' }, update: {}, create: { name: 'MANAGER' } }),
    prisma.role.upsert({ where: { name: 'STAFF' }, update: {}, create: { name: 'STAFF' } }),
    prisma.role.upsert({ where: { name: 'KITCHEN' }, update: {}, create: { name: 'KITCHEN' } }),
  ]);
  const [ownerRole, managerRole, staffRole, kitchenRole] = roles;
  console.log(`   ✅ Created ${roles.length} roles\n`);

  // ==================== 2. USERS ====================
  console.log('👥 Creating users...');
  const hashedPassword = await bcrypt.hash('admin123', 10);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        passwordHash: hashedPassword,
        fullName: 'Admin User',
        roleId: ownerRole.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { username: 'manager' },
      update: {},
      create: {
        username: 'manager',
        passwordHash: hashedPassword,
        fullName: 'Manager User',
        roleId: managerRole.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { username: 'somchai' },
      update: {},
      create: {
        username: 'somchai',
        passwordHash: hashedPassword,
        fullName: 'Somchai Jaidee',
        roleId: managerRole.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { username: 'staff' },
      update: {},
      create: {
        username: 'staff',
        passwordHash: hashedPassword,
        fullName: 'Staff User',
        roleId: staffRole.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { username: 'somsri' },
      update: {},
      create: {
        username: 'somsri',
        passwordHash: hashedPassword,
        fullName: 'Somsri Rakkiet',
        roleId: staffRole.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { username: 'witree' },
      update: {},
      create: {
        username: 'witree',
        passwordHash: hashedPassword,
        fullName: 'Witree Saidee',
        roleId: staffRole.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { username: 'kitchen' },
      update: {},
      create: {
        username: 'kitchen',
        passwordHash: hashedPassword,
        fullName: 'Kitchen User',
        roleId: kitchenRole.id,
        isActive: true,
      },
    }),
    prisma.user.upsert({
      where: { username: 'chef1' },
      update: {},
      create: {
        username: 'chef1',
        passwordHash: hashedPassword,
        fullName: 'Chef Manee',
        roleId: kitchenRole.id,
        isActive: true,
      },
    }),
  ]);
  console.log(`   ✅ Created ${users.length} users\n`);

  // ==================== 3. KITCHEN SECTIONS ====================
  console.log('👨‍🍳 Creating kitchen sections...');
  const kitchens = await Promise.all([
    prisma.kitchenSection.upsert({ where: { name: 'HOT_KITCHEN' }, update: {}, create: { name: 'HOT_KITCHEN' } }),
    prisma.kitchenSection.upsert({ where: { name: 'COLD_KITCHEN' }, update: {}, create: { name: 'COLD_KITCHEN' } }),
    prisma.kitchenSection.upsert({ where: { name: 'BAR' }, update: {}, create: { name: 'BAR' } }),
    prisma.kitchenSection.upsert({ where: { name: 'DESSERT' }, update: {}, create: { name: 'DESSERT' } }),
  ]);
  const [hotKitchen, coldKitchen, bar, dessertKitchen] = kitchens;
  console.log(`   ✅ Created ${kitchens.length} kitchen sections\n`);

  // ==================== 4. CATEGORIES ====================
  console.log('📑 Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'เนื้อวัว', iconUrl: '/icons/beef.svg' } }),
    prisma.category.create({ data: { name: 'เนื้อหมู', iconUrl: '/icons/pork.svg' } }),
    prisma.category.create({ data: { name: 'อาหารทะเล', iconUrl: '/icons/seafood.svg' } }),
    prisma.category.create({ data: { name: 'ลูกชิ้น', iconUrl: '/icons/meatball.svg' } }),
    prisma.category.create({ data: { name: 'ผัก', iconUrl: '/icons/vegetable.svg' } }),
    prisma.category.create({ data: { name: 'เส้น', iconUrl: '/icons/noodle.svg' } }),
    prisma.category.create({ data: { name: 'ไข่', iconUrl: '/icons/egg.svg' } }),
    prisma.category.create({ data: { name: 'ขนมหวาน', iconUrl: '/icons/dessert.svg' } }),
    prisma.category.create({ data: { name: 'เครื่องดื่ม', iconUrl: '/icons/drink.svg' } }),
    prisma.category.create({ data: { name: 'น้ำจิ้ม', iconUrl: '/icons/sauce.svg' } }),
  ]);
  const [beefCat, porkCat, seafoodCat, meatballCat, vegCat, noodleCat, eggCat, dessertCat, drinkCat, sauceCat] = categories;
  console.log(`   ✅ Created ${categories.length} categories\n`);

  // ==================== 5. TIERS ====================
  console.log('💎 Creating pricing tiers...');
  const tiers = await Promise.all([
    prisma.tier.upsert({ where: { name: 'Silver' }, update: {}, create: { name: 'Silver', priceAdult: 399, priceChild: 199, timeLimit: 90 } }),
    prisma.tier.upsert({ where: { name: 'Gold' }, update: {}, create: { name: 'Gold', priceAdult: 599, priceChild: 299, timeLimit: 120 } }),
    prisma.tier.upsert({ where: { name: 'Platinum' }, update: {}, create: { name: 'Platinum', priceAdult: 799, priceChild: 399, timeLimit: 150 } }),
    prisma.tier.upsert({ where: { name: 'Premium' }, update: {}, create: { name: 'Premium', priceAdult: 999, priceChild: 499, timeLimit: 180 } }),
  ]);
  const [silver, gold, platinum, premium] = tiers;
  console.log(`   ✅ Created ${tiers.length} pricing tiers\n`);

  // ==================== 6. MENU ITEMS ====================
  console.log('🍽️  Creating menu items...');
  
  const menuItemsData = [
    // Beef (Hot Kitchen)
    { name: 'เนื้อวัวพรีเมียม', categoryId: beefCat.id, kitchenId: hotKitchen.id, imageUrl: 'https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?w=400' },
    { name: 'เนื้อวัวลายหินอ่อน', categoryId: beefCat.id, kitchenId: hotKitchen.id, imageUrl: 'https://images.unsplash.com/photo-1546964124-0cce460f38ef?w=400' },
    { name: 'เนื้อริบอาย', categoryId: beefCat.id, kitchenId: hotKitchen.id, imageUrl: 'https://images.unsplash.com/photo-1603048297172-c92544798d5a?w=400' },
    { name: 'เนื้อสันใน', categoryId: beefCat.id, kitchenId: hotKitchen.id },
    
    // Pork (Hot Kitchen)
    { name: 'เนื้อหมูหมัก', categoryId: porkCat.id, kitchenId: hotKitchen.id, imageUrl: 'https://images.unsplash.com/photo-1606214220478-8e84d67f88f3?w=400' },
    { name: 'หมูสามชั้น', categoryId: porkCat.id, kitchenId: hotKitchen.id, imageUrl: 'https://images.unsplash.com/photo-1544025162-d76690b67f14?w=400' },
    { name: 'หมูหมักซอสเทอริยากิ', categoryId: porkCat.id, kitchenId: hotKitchen.id },
    
    // Seafood (Hot Kitchen)
    { name: 'กุ้งสด', categoryId: seafoodCat.id, kitchenId: hotKitchen.id, imageUrl: 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=400' },
    { name: 'ปลาหมึกสด', categoryId: seafoodCat.id, kitchenId: hotKitchen.id },
    { name: 'หอยแมลงภู่', categoryId: seafoodCat.id, kitchenId: hotKitchen.id },
    { name: 'ปูทะเล', categoryId: seafoodCat.id, kitchenId: hotKitchen.id, imageUrl: 'https://images.unsplash.com/photo-1553659971-f01207815844?w=400' },
    
    // Meatballs (Hot Kitchen)
    { name: 'ลูกชิ้นเนื้อ', categoryId: meatballCat.id, kitchenId: hotKitchen.id },
    { name: 'ลูกชิ้นหมู', categoryId: meatballCat.id, kitchenId: hotKitchen.id },
    { name: 'ลูกชิ้นปลา', categoryId: meatballCat.id, kitchenId: hotKitchen.id },
    { name: 'ลูกชิ้นกุ้ง', categoryId: meatballCat.id, kitchenId: hotKitchen.id },
    { name: 'บอลเนื้อ', categoryId: meatballCat.id, kitchenId: hotKitchen.id },
    
    // Vegetables (Cold Kitchen)
    { name: 'ผักบุ้ง', categoryId: vegCat.id, kitchenId: coldKitchen.id, imageUrl: 'https://images.unsplash.com/photo-1596560548464-f010549b84d7?w=400' },
    { name: 'ผักกาดขาว', categoryId: vegCat.id, kitchenId: coldKitchen.id },
    { name: 'ผักคะน้า', categoryId: vegCat.id, kitchenId: coldKitchen.id },
    { name: 'เห็ดเข็มทอง', categoryId: vegCat.id, kitchenId: coldKitchen.id, imageUrl: 'https://images.unsplash.com/photo-1628102491629-778571d893a3?w=400' },
    { name: 'เห็ดหอม', categoryId: vegCat.id, kitchenId: coldKitchen.id },
    { name: 'เห็ดออรินจิ', categoryId: vegCat.id, kitchenId: coldKitchen.id },
    { name: 'เต้าหู้', categoryId: vegCat.id, kitchenId: coldKitchen.id },
    { name: 'ผักสลัด', categoryId: vegCat.id, kitchenId: coldKitchen.id },
    { name: 'ข้าวโพดอ่อน', categoryId: vegCat.id, kitchenId: coldKitchen.id },
    { name: 'ฟักทอง', categoryId: vegCat.id, kitchenId: coldKitchen.id },
    
    // Noodles (Cold Kitchen)
    { name: 'วุ้นเส้น', categoryId: noodleCat.id, kitchenId: coldKitchen.id },
    { name: 'บะหมี่ไข่', categoryId: noodleCat.id, kitchenId: coldKitchen.id },
    { name: 'เส้นใหญ่', categoryId: noodleCat.id, kitchenId: coldKitchen.id },
    { name: 'เส้นเล็ก', categoryId: noodleCat.id, kitchenId: coldKitchen.id },
    { name: 'อุด้ง', categoryId: noodleCat.id, kitchenId: coldKitchen.id },
    { name: 'ราเมน', categoryId: noodleCat.id, kitchenId: coldKitchen.id },
    { name: 'ข้าวสวย', categoryId: noodleCat.id, kitchenId: coldKitchen.id },
    
    // Eggs (Cold Kitchen)
    { name: 'ไข่ไก่', categoryId: eggCat.id, kitchenId: coldKitchen.id },
    { name: 'ไข่แดง', categoryId: eggCat.id, kitchenId: coldKitchen.id },
    { name: 'ไข่ขาว', categoryId: eggCat.id, kitchenId: coldKitchen.id },
    
    // Desserts (Dessert Kitchen)
    { name: 'ไอศกรีมวานิลลา', categoryId: dessertCat.id, kitchenId: dessertKitchen.id },
    { name: 'ไอศกรีมช็อกโกแลต', categoryId: dessertCat.id, kitchenId: dessertKitchen.id },
    { name: 'ไอศกรีมสตรอว์เบอร์รี', categoryId: dessertCat.id, kitchenId: dessertKitchen.id },
    { name: 'ไอศกรีมชาเขียว', categoryId: dessertCat.id, kitchenId: dessertKitchen.id },
    { name: 'เค้กช็อกโกแลต', categoryId: dessertCat.id, kitchenId: dessertKitchen.id },
    { name: 'เค้กส้ม', categoryId: dessertCat.id, kitchenId: dessertKitchen.id },
    { name: 'ผลไม้รวม', categoryId: dessertCat.id, kitchenId: dessertKitchen.id },
    
    // Drinks (Bar)
    { name: 'น้ำเปล่า', categoryId: drinkCat.id, kitchenId: bar.id },
    { name: 'น้ำอัดลม', categoryId: drinkCat.id, kitchenId: bar.id },
    { name: 'น้ำผลไม้', categoryId: drinkCat.id, kitchenId: bar.id },
    { name: 'ชาเย็น', categoryId: drinkCat.id, kitchenId: bar.id },
    { name: 'กาแฟเย็น', categoryId: drinkCat.id, kitchenId: bar.id },
    { name: 'นมถั่วเหลือง', categoryId: drinkCat.id, kitchenId: bar.id },
    { name: 'น้ำมะนาว', categoryId: drinkCat.id, kitchenId: bar.id },
    { name: 'น้ำแตงโม', categoryId: drinkCat.id, kitchenId: bar.id },
    
    // Sauces (Cold Kitchen)
    { name: 'น้ำจิ้มซีฟู้ด', categoryId: sauceCat.id, kitchenId: coldKitchen.id },
    { name: 'น้ำจิ้มสุกี้', categoryId: sauceCat.id, kitchenId: coldKitchen.id },
    { name: 'น้ำจิ้มแจ่ว', categoryId: sauceCat.id, kitchenId: coldKitchen.id },
    { name: 'ซอสพริก', categoryId: sauceCat.id, kitchenId: coldKitchen.id },
    { name: 'ซอสมะเขือเทศ', categoryId: sauceCat.id, kitchenId: coldKitchen.id },
  ];

  // Create menu items in batches to avoid too many promises
  const menuItems: any[] = [];
  for (const itemData of menuItemsData) {
    const item = await prisma.menuItem.create({ data: itemData });
    menuItems.push(item);
  }
  
  console.log(`   ✅ Created ${menuItems.length} menu items\n`);

  // ==================== 7. TIER-MENU ITEM RELATIONSHIPS ====================
  console.log('🔗 Creating tier-menu relationships...');
  
  // Silver tier - first 30 items
  const silverItems = menuItems.slice(0, 30);
  for (const item of silverItems) {
    await prisma.tierMenuItem.create({ data: { tierId: silver.id, menuItemId: item.id } });
  }
  
  // Gold tier - first 45 items
  const goldItems = menuItems.slice(0, 45);
  for (const item of goldItems) {
    await prisma.tierMenuItem.create({ data: { tierId: gold.id, menuItemId: item.id } });
  }
  
  // Platinum tier - first 55 items
  const platinumItems = menuItems.slice(0, 55);
  for (const item of platinumItems) {
    await prisma.tierMenuItem.create({ data: { tierId: platinum.id, menuItemId: item.id } });
  }
  
  // Premium tier - all items
  for (const item of menuItems) {
    await prisma.tierMenuItem.create({ data: { tierId: premium.id, menuItemId: item.id } });
  }
  
  console.log(`   ✅ Created tier-menu relationships\n`);

  // ==================== 8. TABLES ====================
  console.log('🪑 Creating tables...');
  
  const tablesData = [
    // Zone A - 10 tables
    ...Array.from({ length: 10 }).map((_, i) => ({ number: `A${i + 1}`, zone: 'Zone A' })),
    // Zone B - 8 tables
    ...Array.from({ length: 8 }).map((_, i) => ({ number: `B${i + 1}`, zone: 'Zone B' })),
    // Zone C - 6 tables (VIP)
    ...Array.from({ length: 6 }).map((_, i) => ({ number: `C${i + 1}`, zone: 'Zone C (VIP)' })),
    // Outdoor - 4 tables
    ...Array.from({ length: 4 }).map((_, i) => ({ number: `OUT${i + 1}`, zone: 'Outdoor' })),
  ];

  const tables: any[] = [];
  for (const tableData of tablesData) {
    const table = await prisma.table.upsert({
      where: { number: tableData.number },
      update: {},
      create: { ...tableData, status: 'AVAILABLE' },
    });
    tables.push(table);
  }
  
  console.log(`   ✅ Created ${tables.length} tables\n`);

  // ==================== 9. INGREDIENTS ====================
  console.log('📦 Creating ingredients...');
  
  const ingredientsData = [
    { name: 'เนื้อวัว', unit: 'kg', currentStock: 50 },
    { name: 'เนื้อหมู', unit: 'kg', currentStock: 40 },
    { name: 'กุ้ง', unit: 'kg', currentStock: 25 },
    { name: 'ปลาหมึก', unit: 'kg', currentStock: 20 },
    { name: 'ผักบุ้ง', unit: 'kg', currentStock: 30 },
    { name: 'ผักกาดขาว', unit: 'kg', currentStock: 35 },
    { name: 'เห็ดเข็มทอง', unit: 'kg', currentStock: 15 },
    { name: 'วุ้นเส้น', unit: 'kg', currentStock: 20 },
    { name: 'บะหมี่ไข่', unit: 'kg', currentStock: 25 },
    { name: 'ไข่ไก่', unit: 'ฟอง', currentStock: 200 },
    { name: 'เต้าหู้', unit: 'ชิ้น', currentStock: 100 },
    { name: 'ไอศกรีม', unit: 'ถ้วย', currentStock: 50 },
    { name: 'น้ำอัดลม', unit: 'กระป๋อง', currentStock: 100 },
    { name: 'น้ำเปล่า', unit: 'ขวด', currentStock: 200 },
    { name: 'ซอสพริก', unit: 'ขวด', currentStock: 30 },
    { name: 'ซอสมะเขือเทศ', unit: 'ขวด', currentStock: 25 },
  ];

  const ingredients: any[] = [];
  for (const ingData of ingredientsData) {
    const ing = await prisma.ingredient.create({ data: ingData });
    ingredients.push(ing);
  }
  
  console.log(`   ✅ Created ${ingredients.length} ingredients\n`);

  // ==================== 10. RECIPES ====================
  console.log('📝 Creating recipes...');
  
  // Create some sample recipes
  const recipesData = [
    { menuItemIndex: 0, ingredientIndex: 0, quantityUsed: 0.15 }, // เนื้อวัวพรีเมียม uses เนื้อวัว
    { menuItemIndex: 1, ingredientIndex: 0, quantityUsed: 0.15 }, // เนื้อวัวลายหินอ่อน uses เนื้อวัว
    { menuItemIndex: 4, ingredientIndex: 1, quantityUsed: 0.15 }, // เนื้อหมูหมัก uses เนื้อหมู
    { menuItemIndex: 7, ingredientIndex: 2, quantityUsed: 0.2 },  // กุ้งสด uses กุ้ง
    { menuItemIndex: 8, ingredientIndex: 3, quantityUsed: 0.2 },  // ปลาหมึกสด uses ปลาหมึก
    { menuItemIndex: 16, ingredientIndex: 4, quantityUsed: 0.1 }, // ผักบุ้ง uses ผักบุ้ง
    { menuItemIndex: 17, ingredientIndex: 5, quantityUsed: 0.1 }, // ผักกาดขาว uses ผักกาดขาว
    { menuItemIndex: 27, ingredientIndex: 7, quantityUsed: 0.1 }, // วุ้นเส้น uses วุ้นเส้น
    { menuItemIndex: 28, ingredientIndex: 8, quantityUsed: 0.12 },// บะหมี่ไข่ uses บะหมี่ไข่
    { menuItemIndex: 33, ingredientIndex: 9, quantityUsed: 1 },   // ไข่ไก่ uses ไข่ไก่
  ];

  for (const recipeData of recipesData) {
    await prisma.recipe.create({
      data: {
        menuItemId: menuItems[recipeData.menuItemIndex].id,
        ingredientId: ingredients[recipeData.ingredientIndex].id,
        quantityUsed: recipeData.quantityUsed,
      },
    });
  }
  
  console.log(`   ✅ Created ${recipesData.length} recipes\n`);

  // ==================== 11. SAMPLE SESSION & ORDER ====================
  console.log('📋 Creating sample session and order...');
  
  // Create a sample active session
  const activeSession = await prisma.session.create({
    data: {
      tableId: tables[0].id,
      tierId: gold.id,
      qrToken: `qr_${Date.now()}_sample`,
      startTime: new Date(),
      endTime: new Date(Date.now() + 2 * 60 * 60 * 1000),
      status: 'ACTIVE',
    },
  });
  
  // Create sample order
  await prisma.order.create({
    data: {
      sessionId: activeSession.id,
      status: 'CONFIRMED',
      items: {
        create: [
          { menuItemId: menuItems[0].id, kitchenId: hotKitchen.id, quantity: 2, status: 'SERVED' },
          { menuItemId: menuItems[4].id, kitchenId: hotKitchen.id, quantity: 2, status: 'SERVED' },
          { menuItemId: menuItems[16].id, kitchenId: coldKitchen.id, quantity: 1, status: 'SERVED' },
          { menuItemId: menuItems[27].id, kitchenId: coldKitchen.id, quantity: 1, status: 'SERVED' },
        ],
      },
    },
  });
  
  console.log(`   ✅ Created sample session and order\n`);

  // ==================== SUMMARY ====================
  await prisma.$disconnect();
  
  console.log('\n✅ ============================================');
  console.log('   SEED COMPLETED SUCCESSFULLY!');
  console.log('   ============================================\n');
  
  console.log('📊 Summary:');
  console.log(`   • Roles: ${roles.length}`);
  console.log(`   • Users: ${users.length}`);
  console.log(`   • Kitchen Sections: ${kitchens.length}`);
  console.log(`   • Categories: ${categories.length}`);
  console.log(`   • Tiers: ${tiers.length}`);
  console.log(`   • Menu Items: ${menuItems.length}`);
  console.log(`   • Tables: ${tables.length}`);
  console.log(`   • Ingredients: ${ingredients.length}`);
  console.log(`   • Sample Session: 1`);
  console.log(`   • Sample Order: 1\n`);
  
  console.log('🔐 Test Credentials:');
  console.log('   • admin / admin123 (OWNER)');
  console.log('   • manager / admin123 (MANAGER)');
  console.log('   • somchai / admin123 (MANAGER)');
  console.log('   • staff / admin123 (STAFF)');
  console.log('   • somsri / admin123 (STAFF)');
  console.log('   • witree / admin123 (STAFF)');
  console.log('   • kitchen / admin123 (KITCHEN)');
  console.log('   • chef1 / admin123 (KITCHEN)\n');
  
  console.log('💎 Pricing Tiers:');
  console.log(`   • Silver: ${silver.priceAdult}฿ adult / ${silver.priceChild}฿ child (${silver.timeLimit} min)`);
  console.log(`   • Gold: ${gold.priceAdult}฿ adult / ${gold.priceChild}฿ child (${gold.timeLimit} min)`);
  console.log(`   • Platinum: ${platinum.priceAdult}฿ adult / ${platinum.priceChild}฿ child (${platinum.timeLimit} min)`);
  console.log(`   • Premium: ${premium.priceAdult}฿ adult / ${premium.priceChild}฿ child (${premium.timeLimit} min)\n`);
  
  console.log('🪑 Tables:');
  console.log(`   • Zone A: 10 tables (A1-A10)`);
  console.log(`   • Zone B: 8 tables (B1-B8)`);
  console.log(`   • Zone C (VIP): 6 tables (C1-C6)`);
  console.log(`   • Outdoor: 4 tables (OUT1-OUT4)\n`);
}

main()
  .catch(console.error)
  .finally(async () => {
    process.exit(0);
  });
