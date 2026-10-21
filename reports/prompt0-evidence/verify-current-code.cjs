// Diagnostic probes only. Imports the existing build, uses in-memory doubles,
// never creates a PrismaClient, connects to a database, or listens on a port.
// A successful probe means the reported behavior was reproduced, not that it is correct.
const path = require('node:path');
const assert = require('node:assert/strict');
const { createRequire, Module } = require('node:module');
const root = path.resolve(__dirname, '../..');
const backend = path.join(root, 'backend');
const appRequire = createRequire(path.join(backend, 'package.json'));
process.env.NODE_PATH = path.join(backend, 'dist');
Module._initPaths();
appRequire('reflect-metadata');
const load = (name) => appRequire(path.join(backend, 'dist/src', name));
const { OrdersService } = load('orders/orders.service.js');
const { OrdersController } = load('orders/orders.controller.js');
const { SessionsService } = load('sessions/sessions.service.js');
const { InvoicesService } = load('invoices/invoices.service.js');
const { SettingsService } = load('settings/settings.service.js');
const { EventsGateway } = load('events/events.gateway.js');
const { RoleController } = load('role/role.controller.js');
const { JwtGuard } = load('auth/guards/jwt.guard.js');
const { IdTransformer } = load('common/utils/id-transformer.util.js');
const { CreateOrderDto } = load('orders/dto/create-order.dto.js');
const { UpdateItemStatusDto } = load('orders/dto/update-item-status.dto.js');
const { Test } = appRequire('@nestjs/testing');
const { validate } = appRequire('class-validator');
const { GUARDS_METADATA } = appRequire('@nestjs/common/constants');
const id = '00000000-0000-4000-8000-000000000001';
const session = {
  id, tableId: 1, tierId: 1, status: 'ACTIVE',
  endTime: new Date('2000-01-01T00:00:00Z'),
  table: { id: 1, number: 'TEST-1' }, tier: { id: 1 },
};
const events = new Proxy({}, { get: () => () => {} });
const transformer = new IdTransformer();
let observed = 0;
async function probe(label, callback) {
  await callback();
  observed++;
  console.log(`OBSERVED ${label}`);
}

async function main() {
  await probe('F01/F02: role routes and public order handlers have no guard metadata', async () => {
    assert.equal(Reflect.getMetadata(GUARDS_METADATA, RoleController), undefined);
    for (const name of ['create', 'findAll', 'findOne', 'update', 'remove']) {
      assert.equal(Reflect.getMetadata(GUARDS_METADATA, RoleController.prototype[name]), undefined);
    }
    assert.equal(Reflect.getMetadata(GUARDS_METADATA, OrdersController), undefined);
    for (const name of ['create', 'findAll']) {
      assert.equal(Reflect.getMetadata(GUARDS_METADATA, OrdersController.prototype[name]), undefined);
    }
  });
  await probe('F02: order listing without sessionId queries without a where constraint', async () => {
    let query;
    const service = new OrdersService({ order: { findMany: async (arg) => { query = arg; return []; } } }, events);
    await service.findAll();
    assert.equal(query.where, undefined);
  });
  await probe('F03: total=100 discount=150 reaches invoice.create with netAmount=-50', async () => {
    let written;
    const prisma = {
      session: { findUnique: async () => session, update: async () => session },
      table: { update: async () => ({}) },
      invoice: { create: async ({ data }) => {
        written = data;
        return { ...data, id, session, createdAt: new Date(0) };
      } },
      $transaction: async (operations) => Promise.all(operations),
    };
    const dto = { sessionId: id, totalAmount: 100, discount: 150, paymentMethod: 'CASH' };
    await new InvoicesService(prisma, events, transformer).create(dto, id);
    assert.equal(written.netAmount, -50);
  });
  await probe('F04: closing a session sends string tbl_000001 into table.update where.id', async () => {
    let query;
    const prisma = {
      session: { findUnique: async () => session, update: async () => session },
      table: { update: async (arg) => { query = arg; return {}; } },
    };
    await new SessionsService(prisma, events, transformer).updateStatus(id, { status: 'CLOSED' });
    assert.equal(query.where.id, 'tbl_000001');
    assert.equal(typeof query.where.id, 'string');
  });
  await probe('F04: prefixed sessionId is passed unchanged to order session lookup', async () => {
    let queried;
    const prisma = { session: { findUnique: async ({ where }) => { queried = where.id; return null; } } };
    await assert.rejects(() => new OrdersService(prisma, events).create({ sessionId: transformer.encode(id, 'ses'), items: [] }));
    assert.equal(queried, transformer.encode(id, 'ses'));
  });
  await probe('F06: past-endTime ACTIVE session and menu outside its tier are accepted by service', async () => {
    let created = false;
    const menu = { id: 'menu-test', kitchenId: 1, isAvailable: true, tierItems: [{ tierId: 2 }] };
    const prisma = {
      session: { findUnique: async () => session },
      menuItem: { findMany: async () => [menu] },
      order: { create: async () => { created = true; return { id, items: [] }; } },
    };
    await new OrdersService(prisma, events).create({ sessionId: id, items: [{ menuItemId: menu.id, quantity: 1 }] });
    assert.equal(created, true);
    assert.ok(session.endTime < new Date());
  });
  await probe('F06/F13: DTO accepts empty items and enum VOIDED', async () => {
    const order = Object.assign(new CreateOrderDto(), { sessionId: id, items: [] });
    const update = Object.assign(new UpdateItemStatusDto(), { status: 'VOIDED' });
    assert.equal((await validate(order)).length, 0);
    assert.equal((await validate(update)).length, 0);
  });
  await probe('F07: join handlers accept a client without credentials', async () => {
    const rooms = [];
    const client = { id: 'synthetic-no-auth-client', join: (room) => rooms.push(room) };
    const gateway = new EventsGateway();
    gateway.handleKitchenJoin({ kitchenId: 1 }, client);
    gateway.handleSessionJoin({ sessionId: id }, client);
    assert.deepEqual(rooms, ['kitchen:1', `session:${id}`]);
  });
  await probe('F09: actual initialized Nest/Express router matches /orders/:id before /orders/void-logs', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [{ provide: OrdersService, useValue: {} }],
    }).overrideGuard(JwtGuard).useValue({ canActivate: () => true }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    try {
      await app.init();
      const layers = app.getHttpAdapter().getInstance().router.stack;
      const matching = layers.filter((layer) => layer.route?.methods.get && layer.match('/orders/void-logs'));
      assert.equal(matching[0].route.path, '/orders/:id');
      assert.ok(matching.some((layer) => layer.route.path === '/orders/void-logs'));
    } finally { await app.close(); }
  });
  await probe('F11: EXPIRED invoice is rejected before any write', async () => {
    const prisma = { session: { findUnique: async () => ({ ...session, status: 'EXPIRED' }) } };
    await assert.rejects(() => new InvoicesService(prisma, events, transformer).create({ sessionId: id }, id), /Session is not active/);
  });
  await probe('F12: payment settings disappear in a new service instance', async () => {
    const first = new SettingsService({});
    await first.updatePaymentSettings({ promptPayNumber: '0000000000' });
    const second = new SettingsService({});
    assert.equal((await first.getPaymentSettings()).promptPayNumber, '0000000000');
    assert.equal((await second.getPaymentSettings()).promptPayNumber, null);
  });
  await probe('F13: updateItemStatus VOIDED bypasses voidLog creation', async () => {
    const item = { id, orderId: id, status: 'PENDING', order: { sessionId: id } };
    let changed;
    const prisma = { orderItem: {
      findUnique: async () => item,
      update: async ({ data }) => { changed = data.status; return { ...item, ...data }; },
    } };
    await new OrdersService(prisma, events).updateItemStatus(id, { status: 'VOIDED' });
    assert.equal(changed, 'VOIDED');
    // No voidLog model exists on this double: the source never calls it here.
  });
  await probe('F15: custom storage serialization failure NOT reproduced in setAuth/rehydrate roundtrip', async () => {
    const fs = require('node:fs');
    const vm = require('node:vm');
    const frontRequire = createRequire(path.join(root, 'frontend/package.json'));
    const ts = frontRequire('typescript');
    const source = fs.readFileSync(path.join(root, 'frontend/src/stores/authStore.ts'), 'utf8');
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const data = new Map();
    const storage = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => data.set(key, value),
      removeItem: (key) => data.delete(key),
    };
    const makeStore = () => {
      const exports = {};
      vm.runInNewContext(compiled, { exports, require: frontRequire, localStorage: storage, document: { cookie: '' }, console });
      return exports.useAuthStore;
    };
    const first = makeStore();
    const user = { id, username: 'synthetic', fullName: 'Synthetic User', role: 'STAFF' };
    first.getState().setAuth(user, 'synthetic-token');
    const second = makeStore();
    assert.equal(second.getState().user.username, 'synthetic');
    assert.equal(second.getState().accessToken, 'synthetic-token');
  });
  console.log(`Completed ${observed} diagnostic probes; no database/network server used.`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
