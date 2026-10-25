require('dotenv/config');

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

const scenarios = [
  {
    table: 'A2', tier: 'Gold', token: 'test-data-active-kitchen-a2',
    status: 'ACTIVE', tableStatus: 'OCCUPIED', adults: 2, children: 0,
    orders: [
      { status: 'CONFIRMED', items: [
        { name: 'เนื้อวัวพรีเมียม', quantity: 2, status: 'PREPARING' },
        { name: 'ผักบุ้ง', quantity: 1, status: 'PENDING' },
        { name: 'น้ำเปล่า', quantity: 2, status: 'SERVED' },
      ] },
    ],
  },
  {
    table: 'A3', tier: 'Silver', token: 'test-data-pending-order-a3',
    status: 'ACTIVE', tableStatus: 'OCCUPIED', adults: 1, children: 1,
    orders: [
      { status: 'PENDING', items: [
        { name: 'เนื้อหมูหมัก', quantity: 2, status: 'PENDING' },
        { name: 'ผักกาดขาว', quantity: 1, status: 'PENDING' },
      ] },
    ],
  },
  {
    table: 'A4', tier: 'Platinum', token: 'test-data-paid-table-a4',
    status: 'CLOSED', tableStatus: 'CLEANING', adults: 2, children: 1,
    orders: [
      { status: 'CONFIRMED', items: [
        { name: 'เนื้อวัวพรีเมียม', quantity: 2, status: 'SERVED' },
        { name: 'กุ้งสด', quantity: 1, status: 'SERVED' },
        { name: 'น้ำอัดลม', quantity: 3, status: 'VOIDED', voidReason: 'Customer changed order' },
      ] },
    ],
    invoice: { totalAmount: 1997, discount: 100, netAmount: 1897, paymentMethod: 'CASH' },
  },
  {
    table: 'A5', tier: 'Gold', token: 'test-data-cancelled-order-a5',
    status: 'ACTIVE', tableStatus: 'OCCUPIED', adults: 3, children: 0,
    orders: [
      { status: 'CANCELLED', items: [
        { name: 'เนื้อหมูหมัก', quantity: 2, status: 'VOIDED', voidReason: 'Duplicate order' },
      ] },
      { status: 'CONFIRMED', items: [
        { name: 'กุ้งสด', quantity: 2, status: 'PREPARING' },
        { name: 'น้ำเปล่า', quantity: 3, status: 'SERVED' },
      ] },
    ],
  },
  {
    table: 'A6', tier: 'Premium', token: 'test-data-bar-dessert-a6',
    status: 'ACTIVE', tableStatus: 'OCCUPIED', adults: 2, children: 0,
    orders: [
      { status: 'CONFIRMED', items: [
        { name: 'ไอศกรีมวานิลลา', quantity: 2, status: 'PREPARING' },
        { name: 'ชาเย็น', quantity: 2, status: 'PENDING' },
        { name: 'เนื้อวัวพรีเมียม', quantity: 1, status: 'SERVED' },
      ] },
    ],
  },
  {
    table: 'B1', tier: 'Silver', token: 'test-data-paid-yesterday-b1',
    status: 'CLOSED', tableStatus: 'AVAILABLE', adults: 2, children: 0,
    daysAgo: 1,
    orders: [{ status: 'CONFIRMED', items: [
      { name: 'เนื้อหมูหมัก', quantity: 2, status: 'SERVED' },
      { name: 'ผักบุ้ง', quantity: 1, status: 'SERVED' },
    ] }],
    invoice: { totalAmount: 798, discount: 0, netAmount: 798, paymentMethod: 'QR_CODE' },
  },
  {
    table: 'B2', tier: 'Gold', token: 'test-data-paid-two-days-b2',
    status: 'CLOSED', tableStatus: 'AVAILABLE', adults: 3, children: 1,
    daysAgo: 2,
    orders: [{ status: 'CONFIRMED', items: [
      { name: 'กุ้งสด', quantity: 2, status: 'SERVED' },
      { name: 'น้ำอัดลม', quantity: 4, status: 'SERVED' },
    ] }],
    invoice: { totalAmount: 2096, discount: 100, netAmount: 1996, paymentMethod: 'CREDIT_CARD' },
  },
  {
    table: 'B3', tier: 'Platinum', token: 'test-data-paid-three-days-b3',
    status: 'CLOSED', tableStatus: 'AVAILABLE', adults: 2, children: 2,
    daysAgo: 3,
    orders: [{ status: 'CONFIRMED', items: [
      { name: 'เนื้อวัวพรีเมียม', quantity: 3, status: 'SERVED' },
      { name: 'ไอศกรีมวานิลลา', quantity: 4, status: 'SERVED' },
    ] }],
    invoice: { totalAmount: 2396, discount: 0, netAmount: 2396, paymentMethod: 'DEBIT_CARD' },
  },
  {
    table: 'B4', tier: 'Premium', token: 'test-data-paid-four-days-b4',
    status: 'CLOSED', tableStatus: 'AVAILABLE', adults: 4, children: 0,
    daysAgo: 4,
    orders: [{ status: 'CONFIRMED', items: [
      { name: 'กุ้งสด', quantity: 4, status: 'SERVED' },
      { name: 'ชาเย็น', quantity: 4, status: 'SERVED' },
    ] }],
    invoice: { totalAmount: 3996, discount: 200, netAmount: 3796, paymentMethod: 'CASH' },
  },
  {
    table: 'C1', tier: 'Premium', token: 'test-data-vip-c1',
    status: 'ACTIVE', tableStatus: 'OCCUPIED', adults: 4, children: 1,
    orders: [{ status: 'PENDING', items: [
      { name: 'เนื้อวัวพรีเมียม', quantity: 4, status: 'PENDING' },
      { name: 'ไอศกรีมวานิลลา', quantity: 2, status: 'PENDING' },
      { name: 'ชาเย็น', quantity: 4, status: 'PENDING' },
    ] }],
  },
  {
    table: 'OUT1', tier: 'Silver', token: 'test-data-expired-out1',
    status: 'EXPIRED', tableStatus: 'CLEANING', adults: 2, children: 0,
    hoursAgo: 4,
    orders: [{ status: 'CONFIRMED', items: [
      { name: 'เนื้อหมูหมัก', quantity: 2, status: 'SERVED' },
      { name: 'ผักกาดขาว', quantity: 1, status: 'SERVED' },
    ] }],
  },
];

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const tableNumbers = scenarios.map((scenario) => scenario.table);
    const menuNames = [...new Set(scenarios.flatMap((scenario) =>
      scenario.orders.flatMap((order) => order.items.map((item) => item.name))))];
    const [tables, tiers, menuItems, manager] = await Promise.all([
      prisma.table.findMany({ where: { number: { in: tableNumbers } } }),
      prisma.tier.findMany({ where: { name: { in: scenarios.map((scenario) => scenario.tier) } } }),
      prisma.menuItem.findMany({ where: { name: { in: menuNames } } }),
      prisma.user.findUnique({ where: { username: 'manager' } }),
    ]);
    const byNumber = new Map(tables.map((table) => [table.number, table]));
    const byTier = new Map(tiers.map((tier) => [tier.name, tier]));
    const byMenu = new Map(menuItems.map((item) => [item.name, item]));
    const missing = [
      ...tableNumbers.filter((number) => !byNumber.has(number)).map((number) => `table ${number}`),
      ...scenarios.map((scenario) => scenario.tier).filter((tier) => !byTier.has(tier)).map((tier) => `tier ${tier}`),
      ...menuNames.filter((name) => !byMenu.has(name)).map((name) => `menu item ${name}`),
      ...(!manager ? ['user manager'] : []),
    ];
    if (missing.length) {
      throw new Error(`Missing base data (${missing.join(', ')}). Run npm run seed on a fresh database first.`);
    }

    for (const scenario of scenarios) {
      const table = byNumber.get(scenario.table);
      const tier = byTier.get(scenario.tier);
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.session.findUnique({ where: { qrToken: scenario.token } });
        if (existing) return 'skipped';

        // Scenario rows use dedicated tables. Leave any live restaurant data untouched.
        const currentTable = await tx.table.findUnique({ where: { id: table.id } });
        const activeSession = await tx.session.findFirst({
          where: { tableId: table.id, status: 'ACTIVE' },
        });
        if (currentTable.status !== 'AVAILABLE' || activeSession) return 'busy';

        const now = new Date();
        const startTime = new Date(now.getTime()
          - (scenario.daysAgo || 0) * 24 * 60 * 60 * 1000
          - (scenario.hoursAgo ?? (scenario.status === 'CLOSED' ? 3 : 0)) * 60 * 60 * 1000);
        const orderTime = new Date(startTime.getTime() + 20 * 60 * 1000);
        const session = await tx.session.create({
          data: {
            tableId: table.id,
            tierId: tier.id,
            qrToken: scenario.token,
            adultCount: scenario.adults,
            childCount: scenario.children,
            startTime,
            endTime: new Date(startTime.getTime() + tier.timeLimit * 60 * 1000),
            status: scenario.status,
          },
        });

        for (const orderData of scenario.orders) {
          const order = await tx.order.create({
            data: { sessionId: session.id, status: orderData.status, createdAt: orderTime },
          });
          for (const itemData of orderData.items) {
            const menuItem = byMenu.get(itemData.name);
            const item = await tx.orderItem.create({
              data: {
                orderId: order.id,
                menuItemId: menuItem.id,
                kitchenId: menuItem.kitchenId,
                quantity: itemData.quantity,
                status: itemData.status,
              },
            });
            if (itemData.voidReason) {
              await tx.voidLog.create({
                data: {
                  orderItemId: item.id,
                  reason: itemData.voidReason,
                  approvedBy: manager.id,
                  createdAt: orderTime,
                },
              });
            }
          }
        }

        if (scenario.invoice) {
          await tx.invoice.create({
            data: {
              sessionId: session.id,
              createdBy: manager.id,
              createdAt: new Date(startTime.getTime() + 80 * 60 * 1000),
              ...scenario.invoice,
            },
          });
        }
        await tx.table.update({
          where: { id: table.id }, data: { status: scenario.tableStatus },
        });
        return 'created';
      });
      const action = result === 'created' ? 'Created'
        : result === 'busy' ? 'Skipped busy table' : 'Skipped existing scenario';
      console.log(`${action} ${scenario.table}: ${scenario.token}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Could not seed test scenarios:', error);
  process.exitCode = 1;
});
