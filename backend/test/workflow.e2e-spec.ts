import { randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { io, Socket } from '../../frontend/node_modules/socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResponseInterceptor } from '../src/common/response.interceptor';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { SessionsService } from '../src/sessions/sessions.service';
import {
  IdPrefix,
  IdTransformer,
} from '../src/common/utils/id-transformer.util';

const target = new URL(
  process.env.DATABASE_URL || 'postgresql://invalid/invalid',
);
if (
  process.env.ALLOW_SHABU_TEST_DB !== '1' ||
  target.hostname !== '127.0.0.1' ||
  target.port !== '55432' ||
  !/^\/(?:shabu_workflow_\d+|shabu_payment_empty_\d+)$/.test(target.pathname)
)
  throw new Error('Isolated workflow test DB opt-in required');
const data = <T>(res: request.Response): T => (res.body as { data: T }).data;
type Order = {
  id: string;
  sessionId: string;
  status: string;
  items: { id: string; status: string; menuItem: { id: string } }[];
};
type Session = {
  id: string;
  qrToken: string;
  token: string;
  wireId: string;
  tableId: number;
};

describe('QR -> Order -> KDS -> Status (HTTP/JWT/PostgreSQL/Socket)', () => {
  let app: INestApplication<Server>, prisma: PrismaService, origin: string;
  const sockets: Socket[] = [];
  const marker = randomUUID(),
    roleName = `WORKFLOW-${marker}`;
  const ids = new IdTransformer();
  let tierId: number,
    kitchen: number,
    otherKitchen: number,
    menu: string,
    menu2: string,
    unavailable: string,
    outside: string;
  let actor: string, staff: string, noPermission: string;
  let a: Session, b: Session;

  async function session(): Promise<Session> {
    const table = await prisma.table.create({
      data: { number: randomUUID(), status: 'OCCUPIED' },
    });
    const row = await prisma.session.create({
      data: {
        tableId: table.id,
        tierId,
        qrToken: randomUUID(),
        endTime: new Date(Date.now() + 3600000),
      },
    });
    const exchange = data<{ id: string; customerAccessToken: string }>(
      await request(app.getHttpServer())
        .get(`/sessions/qr/${row.qrToken}`)
        .expect(200),
    );
    return {
      id: row.id,
      qrToken: row.qrToken,
      token: exchange.customerAccessToken,
      wireId: exchange.id,
      tableId: table.id,
    };
  }
  const api = () => request(app.getHttpServer());
  const create = (s = a, items = [{ menuItemId: menu, quantity: 1 }]) =>
    api()
      .post('/customer/orders')
      .auth(s.token, { type: 'bearer' })
      .send({ sessionId: s.wireId, items });
  const patch = (item: string, status: string) =>
    api()
      .patch(`/orders/items/${item}/status`)
      .auth(staff, { type: 'bearer' })
      .send({ status });
  const confirm = (id: string, status = 'CONFIRMED') =>
    api()
      .patch(`/orders/${id}/status`)
      .auth(staff, { type: 'bearer' })
      .send({ status });
  const voidItem = (id: string, reason = 'workflow test approved') =>
    api()
      .post(`/orders/items/${id}/void`)
      .auth(staff, { type: 'bearer' })
      .send({ reason });
  function event<T>(socket: Socket, name: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const handler = (value: T) => {
        clearTimeout(timer);
        resolve(value);
      };
      const timer = setTimeout(() => {
        socket.off(name, handler);
        reject(new Error(`Missing ${name}`));
      }, 3000);
      socket.once(name, handler);
    });
  }
  async function connect(auth: object) {
    const socket = io(origin, {
      auth,
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
      autoConnect: false,
    });
    sockets.push(socket);
    const connected = event(socket, 'connect');
    socket.connect();
    await connected;
    return socket;
  }
  async function join(
    socket: Socket,
    kind: 'session' | 'kitchen',
    id: string | number,
  ) {
    const joined = event(socket, `${kind}:joined`);
    socket.emit(
      `${kind}:join`,
      kind === 'session' ? { sessionId: id } : { kitchenId: id },
    );
    await joined;
  }

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const role = await prisma.role.create({ data: { name: roleName } });
    actor = (
      await prisma.user.create({
        data: {
          username: marker,
          fullName: 'Workflow fixture',
          roleId: role.id,
          passwordHash: 'unused-fixture',
        },
      })
    ).id;
    kitchen = (
      await prisma.kitchenSection.create({
        data: { name: `${marker}-kitchen` },
      })
    ).id;
    otherKitchen = (
      await prisma.kitchenSection.create({ data: { name: `${marker}-other` } })
    ).id;
    tierId = (
      await prisma.tier.create({
        data: { name: marker, priceAdult: 1, priceChild: 1 },
      })
    ).id;
    const categoryId = (
      await prisma.category.create({ data: { name: marker } })
    ).id;
    async function makeMenu(inTier: boolean, isAvailable = true) {
      return (
        await prisma.menuItem.create({
          data: {
            name: randomUUID(),
            categoryId,
            kitchenId: kitchen,
            isAvailable,
            ...(inTier ? { tierItems: { create: { tierId } } } : {}),
          },
        })
      ).id;
    }
    menu = await makeMenu(true);
    menu2 = await makeMenu(true);
    unavailable = await makeMenu(true, false);
    outside = await makeMenu(false);
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          ...process.env,
          STAFF_PERMISSION_GRANTS: JSON.stringify({
            [roleName]: [
              'orders.read',
              'orders.write',
              'orders.void',
              'void-logs.read',
              'kitchens.read',
              'kitchen.orders.read',
              'kitchen.orders.write',
              'sessions.read',
              'sessions.write',
            ],
          }),
          KITCHEN_USER_ASSIGNMENTS: JSON.stringify({ [actor]: [kitchen] }),
        }),
      )
      .compile();
    app = moduleRef.createNestApplication<INestApplication<Server>>();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0, '127.0.0.1');
    origin = await app.getUrl();
    const jwt = new JwtService();
    staff = jwt.sign(
      { sub: actor, username: marker, kind: 'access' },
      { secret: process.env.JWT_SECRET, algorithm: 'HS256', expiresIn: '1h' },
    );
    const otherRole = await prisma.role.create({
      data: { name: `UNGRANTED-${marker}` },
    });
    const other = await prisma.user.create({
      data: {
        username: randomUUID(),
        fullName: 'Denied fixture',
        roleId: otherRole.id,
        passwordHash: 'unused-fixture',
      },
    });
    noPermission = jwt.sign(
      { sub: other.id, kind: 'access' },
      { secret: process.env.JWT_SECRET, algorithm: 'HS256', expiresIn: '1h' },
    );
    a = await session();
    b = await session();
  }, 30000);
  afterAll(async () => {
    sockets.forEach((s) => s.disconnect());
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  it('auth and ownership remain enforced for both REST and rooms', async () => {
    await api().get('/orders').expect(401);
    await api()
      .get('/orders')
      .auth(noPermission, { type: 'bearer' })
      .expect(403);
    await api()
      .post('/customer/orders')
      .send({ sessionId: a.id, items: [{ menuItemId: menu, quantity: 1 }] })
      .expect(401);
    await api()
      .post('/customer/orders')
      .auth(a.token, { type: 'bearer' })
      .send({ sessionId: b.id, items: [{ menuItemId: menu, quantity: 1 }] })
      .expect(403);
    const customer = await connect({ customerToken: a.token });
    const denied = event<{ statusCode: number }>(customer, 'exception');
    customer.emit('session:join', { sessionId: b.id });
    expect((await denied).statusCode).toBe(403);
    const cook = await connect({ accessToken: staff });
    const deniedKitchen = event<{ statusCode: number }>(cook, 'exception');
    cook.emit('kitchen:join', { kitchenId: otherKitchen });
    expect((await deniedKitchen).statusCode).toBe(403);
  });
  it('menu is restricted to tier AND availability; uses the real /kitchens contract and static void logs route', async () => {
    const res = await api()
      .get('/customer/menu-items')
      .auth(a.token, { type: 'bearer' })
      .expect(200);
    expect(
      data<{ id: string }[]>(res)
        .map((row) => row.id)
        .sort(),
    ).toEqual([menu, menu2].sort());
    const kitchens = await api()
      .get('/kitchens')
      .auth(staff, { type: 'bearer' })
      .expect(200);
    expect(
      data<{ id: number }[]>(kitchens).some((row) => row.id === kitchen),
    ).toBe(true);
    const logs = await api()
      .get('/orders/void-logs')
      .auth(staff, { type: 'bearer' })
      .expect(200);
    expect(Array.isArray(data(logs))).toBe(true);
  });
  it.each(
    [
      [],
      [{ quantity: 1 }],
      [{ menuItemId: 'invalid', quantity: 1 }],
      [{ menuItemId: 'PLACEHOLDER', quantity: 0 }],
      [{ menuItemId: 'PLACEHOLDER', quantity: -1 }],
      [{ menuItemId: 'PLACEHOLDER', quantity: 1.2 }],
      [{ menuItemId: 'PLACEHOLDER', quantity: '1' }],
      [{ menuItemId: 'PLACEHOLDER', quantity: 100 }],
      Array.from({ length: 101 }, () => ({
        menuItemId: 'PLACEHOLDER',
        quantity: 1,
      })),
    ].map((payload) => [payload]),
  )('rejects malformed/empty/out-of-bounds items: %j', async (payload) => {
    const items = (
      payload as Array<{ menuItemId?: string; quantity: unknown }>
    ).map((item) => ({
      ...item,
      ...('menuItemId' in item && item.menuItemId === 'PLACEHOLDER'
        ? { menuItemId: menu }
        : {}),
    }));
    const before = await prisma.order.count({ where: { sessionId: a.id } });
    await api()
      .post('/customer/orders')
      .auth(a.token, { type: 'bearer' })
      .send({ items })
      .expect(400);
    await api()
      .post('/orders')
      .auth(staff, { type: 'bearer' })
      .send({ sessionId: a.id, items })
      .expect(400);
    expect(await prisma.order.count({ where: { sessionId: a.id } })).toBe(
      before,
    );
  });
  it('rejects out-of-tier/unavailable/nonexistent and duplicate raw/prefixed menu entries through both APIs', async () => {
    for (const id of [outside, unavailable, randomUUID()]) {
      await create(a, [{ menuItemId: id, quantity: 1 }]).expect(400);
      await api()
        .post('/orders')
        .auth(staff, { type: 'bearer' })
        .send({ sessionId: a.id, items: [{ menuItemId: id, quantity: 1 }] })
        .expect(400);
    }
    await create(a, [
      { menuItemId: menu, quantity: 1 },
      { menuItemId: ids.encode(menu, IdPrefix.MENU_ITEM), quantity: 1 },
    ]).expect(400);
    await api()
      .post('/orders')
      .auth(staff, { type: 'bearer' })
      .send({
        sessionId: randomUUID(),
        items: [{ menuItemId: menu, quantity: 1 }],
      })
      .expect(404);
  });
  it('checks server endTime before cron; closed/expired credentials cannot read or order', async () => {
    const expired = await session();
    await prisma.session.update({
      where: { id: expired.id },
      data: { endTime: new Date(Date.now() - 1000) },
    });
    await create(expired).expect(403);
    await api()
      .get('/customer/orders')
      .auth(expired.token, { type: 'bearer' })
      .expect(403);
    await api()
      .post('/orders')
      .auth(staff, { type: 'bearer' })
      .send({
        sessionId: expired.wireId,
        items: [{ menuItemId: menu, quantity: 1 }],
      })
      .expect(400);
    await app.get(SessionsService).checkSessionTime();
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: expired.id } }))
        .status,
    ).toBe('EXPIRED');
    expect(
      (await prisma.table.findUniqueOrThrow({ where: { id: expired.tableId } }))
        .status,
    ).toBe('CLEANING');
  });
  it('QR orders reach assigned KDS; kitchen updates reach customer AND another KDS after commit; reconnect resyncs', async () => {
    const buyer = await connect({ customerToken: a.token }),
      cook = await connect({ accessToken: staff }),
      observer = await connect({ accessToken: staff });
    await join(buyer, 'session', a.wireId);
    await join(cook, 'kitchen', kitchen);
    await join(observer, 'kitchen', kitchen);
    const received = event<{
      orderId: string;
      items: { id: string; status: string }[];
    }>(cook, 'kitchen:new_order');
    const orderEvent = event<Order>(buyer, 'order:status_changed');
    const order = data<Order>(await create().expect(201));
    expect((await received).orderId).toBe(order.id);
    expect((await orderEvent).items).toEqual(order.items);
    const listed = data<{ id: string }[]>(
      await api()
        .get(`/orders/kitchen/${kitchen}`)
        .auth(staff, { type: 'bearer' })
        .expect(200),
    );
    expect(listed.some((row) => row.id === order.items[0].id)).toBe(true);
    const customerEvent = event<{ status: string }>(
      buyer,
      'order:item_status_changed',
    );
    const kdsEvent = event<{ status: string }>(
      observer,
      'kitchen:item_status_changed',
    );
    const updated = data<{ status: string }>(
      await patch(order.items[0].id, 'PREPARING').expect(200),
    );
    expect((await customerEvent).status).toBe(updated.status);
    expect((await kdsEvent).status).toBe(updated.status);
    expect(
      (
        await prisma.orderItem.findUniqueOrThrow({
          where: { id: order.items[0].id },
        })
      ).status,
    ).toBe(updated.status);
    buyer.disconnect();
    observer.disconnect();
    await patch(order.items[0].id, 'SERVED').expect(200);
    const connected = event(buyer, 'connect');
    buyer.connect();
    await connected;
    await join(buyer, 'session', a.wireId);
    const history = data<Order[]>(
      await api()
        .get('/customer/orders')
        .auth(a.token, { type: 'bearer' })
        .expect(200),
    );
    expect(history.find((row) => row.id === order.id)?.items[0].status).toBe(
      'SERVED',
    );
    expect(history.find((row) => row.id === order.id)?.status).toBe(
      'CONFIRMED',
    );
    const reconnected = event(observer, 'connect');
    observer.connect();
    await reconnected;
    await join(observer, 'kitchen', kitchen);
    const synced = data<{ id: string; status: string }[]>(
      await api()
        .get(`/orders/kitchen/${kitchen}`)
        .auth(staff, { type: 'bearer' })
        .expect(200),
    );
    expect(synced.find((row) => row.id === order.items[0].id)?.status).toBe(
      'SERVED',
    );
  });
  it('confirmation returns post-transaction items and emits only actually changed items', async () => {
    const order = data<Order>(
      await create(a, [
        { menuItemId: menu, quantity: 1 },
        { menuItemId: menu2, quantity: 1 },
      ]).expect(201),
    );
    await patch(order.items[0].id, 'PREPARING').expect(200);
    await patch(order.items[0].id, 'SERVED').expect(200);
    const cook = await connect({ accessToken: staff });
    await join(cook, 'kitchen', kitchen);
    const changes: { orderItemId: string; status: string }[] = [];
    const handler = (value: { orderItemId: string; status: string }) =>
      changes.push(value);
    cook.on('kitchen:item_status_changed', handler);
    const result = data<Order>(await confirm(order.id).expect(200));
    cook.off('kitchen:item_status_changed', handler);
    expect(
      result.items.find((row) => row.id === order.items[0].id)?.status,
    ).toBe('SERVED');
    expect(
      result.items.find((row) => row.id === order.items[1].id)?.status,
    ).toBe('PREPARING');
    expect(changes.map((row) => row.orderItemId)).toEqual([order.items[1].id]);
    expect(changes[0].status).toBe('PREPARING');
    const db = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { items: true },
    });
    expect(db.items.map((row) => [row.id, row.status]).sort()).toEqual(
      result.items.map((row) => [row.id, row.status]).sort(),
    );
    await confirm(order.id).expect(400);
    await confirm(order.id, 'PENDING').expect(400);
    await confirm(order.id, 'CANCELLED').expect(400);
  });
  it('rejects backward/skipped/terminal transitions and VOIDED shortcut; cancelled legacy order stays cancelled', async () => {
    const order = data<Order>(await create().expect(201)),
      item = order.items[0].id;
    for (const status of ['PENDING', 'SERVED', 'VOIDED'])
      await patch(item, status).expect(400);
    await patch(item, 'PREPARING').expect(200);
    await patch(item, 'PENDING').expect(400);
    await patch(item, 'SERVED').expect(200);
    await patch(item, 'PREPARING').expect(400);
    await voidItem(item).expect(400);
    const cancelled = data<Order>(await create().expect(201));
    await prisma.order.update({
      where: { id: cancelled.id },
      data: { status: 'CANCELLED' },
    });
    await patch(cancelled.items[0].id, 'PREPARING').expect(400);
    await confirm(cancelled.id).expect(400);
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: cancelled.id } }))
        .status,
    ).toBe('CANCELLED');
  });
  it('every accepted VOIDED has one actor/reason log; concurrent void cannot create a second log', async () => {
    const order = data<Order>(await create().expect(201)),
      id = order.items[0].id;
    await voidItem(id, '   ').expect(400);
    const responses = await Promise.all([voidItem(id), voidItem(id)]);
    expect(responses.filter((res) => res.status === 201)).toHaveLength(1);
    expect(
      responses.filter((res) => [400, 409].includes(res.status)),
    ).toHaveLength(1);
    const logs = await prisma.voidLog.findMany({ where: { orderItemId: id } });
    expect(logs).toHaveLength(1);
    expect(logs[0].approvedBy).toBe(actor);
    expect(logs[0].reason).toBe('workflow test approved');
    expect(
      (await prisma.orderItem.findUniqueOrThrow({ where: { id } })).status,
    ).toBe('VOIDED');
    await patch(id, 'PREPARING').expect(400);
  });
  it('PREPARING can be audited VOIDED; confirmation never revives it or emits a false item change', async () => {
    const order = data<Order>(
      await create(a, [
        { menuItemId: menu, quantity: 99 },
        { menuItemId: menu2, quantity: 1 },
      ]).expect(201),
    );
    const id = order.items[0].id;
    await patch(id, 'PREPARING').expect(200);
    await voidItem(id).expect(201);
    const log = await prisma.voidLog.findUniqueOrThrow({
      where: { orderItemId: id },
    });
    expect(log.approvedBy).toBe(actor);
    const cook = await connect({ accessToken: staff });
    await join(cook, 'kitchen', kitchen);
    const changes: { orderItemId: string }[] = [];
    const listener = (value: { orderItemId: string }) => changes.push(value);
    cook.on('kitchen:item_status_changed', listener);
    const result = data<Order>(await confirm(order.id).expect(200));
    cook.off('kitchen:item_status_changed', listener);
    expect(result.items.find((row) => row.id === id)?.status).toBe('VOIDED');
    expect(changes.map((row) => row.orderItemId)).toEqual([order.items[1].id]);
  });
  it('confirmation failure rolls back header AND child status and emits nothing', async () => {
    const order = data<Order>(await create().expect(201));
    const cook = await connect({ accessToken: staff });
    await join(cook, 'kitchen', kitchen);
    const changes: unknown[] = [];
    const listener = (value: unknown) => changes.push(value);
    cook.on('kitchen:item_status_changed', listener);
    // UUID originates from the fixture DB; this trigger exists only in the opt-in workflow test database.
    await prisma.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION workflow_fail_confirm() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.id = '${order.id}' THEN RAISE EXCEPTION 'workflow test header failure'; END IF; RETURN NEW; END $$`,
    );
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER workflow_fail_confirm BEFORE UPDATE ON "Order" FOR EACH ROW EXECUTE FUNCTION workflow_fail_confirm()',
    );
    try {
      await confirm(order.id).expect(500);
      const db = await prisma.order.findUniqueOrThrow({
        where: { id: order.id },
        include: { items: true },
      });
      expect(db.status).toBe('PENDING');
      expect(db.items[0].status).toBe('PENDING');
      expect(changes).toEqual([]);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER workflow_fail_confirm ON "Order"',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION workflow_fail_confirm()');
      cook.off('kitchen:item_status_changed', listener);
    }
  });
  it('audit insert failure rolls back item and produces no status/void events', async () => {
    const order = data<Order>(await create().expect(201)),
      id = order.items[0].id;
    const cook = await connect({ accessToken: staff });
    await join(cook, 'kitchen', kitchen);
    const observed: unknown[] = [];
    const listener = (value: unknown) => observed.push(value);
    cook.on('kitchen:void_order', listener);
    cook.on('kitchen:item_status_changed', listener);
    await prisma.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION workflow_fail_void() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason = 'WORKFLOW_ROLLBACK_TEST' THEN RAISE EXCEPTION 'workflow test audit failure'; END IF; RETURN NEW; END $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER workflow_fail_void BEFORE INSERT ON "VoidLog" FOR EACH ROW EXECUTE FUNCTION workflow_fail_void()`,
    );
    try {
      await voidItem(id, 'WORKFLOW_ROLLBACK_TEST').expect(500);
      expect(
        (await prisma.orderItem.findUniqueOrThrow({ where: { id } })).status,
      ).toBe('PENDING');
      expect(await prisma.voidLog.count({ where: { orderItemId: id } })).toBe(
        0,
      );
      expect(observed).toEqual([]);
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER workflow_fail_void ON "VoidLog"',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION workflow_fail_void()');
      cook.off('kitchen:void_order', listener);
      cook.off('kitchen:item_status_changed', listener);
    }
  });
  it('closing the session disconnects its authenticated socket and prevents further requests', async () => {
    const closed = await session(),
      buyer = await connect({ customerToken: closed.token });
    await join(buyer, 'session', closed.id);
    const disconnected = event(buyer, 'disconnect');
    await api()
      .patch(`/sessions/${closed.wireId}/status`)
      .auth(staff, { type: 'bearer' })
      .send({ status: 'CLOSED' })
      .expect(200);
    await disconnected;
    await api().get(`/sessions/qr/${closed.qrToken}`).expect(403);
    await create(closed).expect(403);
    expect(
      (await prisma.table.findUniqueOrThrow({ where: { id: closed.tableId } }))
        .status,
    ).toBe('CLEANING');
  });
});
