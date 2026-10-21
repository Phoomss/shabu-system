import { randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { io, Socket } from '../../frontend/node_modules/socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EventsGateway } from '../src/events/events.gateway';
import { ResponseInterceptor } from '../src/common/response.interceptor';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { PERMISSIONS } from '../src/security/policy';
import { corsOptions } from '../src/security/cors';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const target = new URL(
  process.env.DATABASE_URL || 'postgresql://invalid/invalid',
);
if (
  process.env.ALLOW_SHABU_TEST_DB !== '1' ||
  target.hostname !== '127.0.0.1' ||
  target.port !== '55432' ||
  !/^\/(?:shabu_security_\d+|shabu_payment_empty_\d+)$/.test(target.pathname)
)
  throw new Error('Isolated security test DB opt-in required');
function data<T>(response: request.Response): T {
  return (response.body as { data: T }).data;
}
type Customer = {
  id: string;
  customerAccessToken: string;
  credentialExpiresAt: string;
};
const customerKey = 'isolated-security-customer-signing-key';
const jwt = new JwtService();

describe('Security authorization (real HTTP, JWT, PostgreSQL, Socket.IO)', () => {
  let app: INestApplication<Server>;
  let defaultApp: INestApplication<Server>;
  let prisma: PrismaService;
  let gateway: EventsGateway;
  let origin: string;
  const marker = randomUUID();
  const tokens: Record<string, string> = {};
  const users: Record<string, string> = {};
  const sockets: Socket[] = [];
  let kitchen1: number, kitchen2: number, tierId: number, menuId: string;
  let a: Customer, b: Customer;
  let sessionA: string, sessionB: string, qrA: string;
  let itemA: string;
  const username = (role: string) => `${marker}-${role}`;

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    const kitchen = await prisma.kitchenSection.create({
      data: { name: `${marker}-one` },
    });
    kitchen1 = kitchen.id;
    kitchen2 = (
      await prisma.kitchenSection.create({ data: { name: `${marker}-two` } })
    ).id;
    const tier = await prisma.tier.create({
      data: { name: marker, priceAdult: 1234, priceChild: 567 },
    });
    tierId = tier.id;
    const category = await prisma.category.create({ data: { name: marker } });
    menuId = (
      await prisma.menuItem.create({
        data: {
          name: marker,
          categoryId: category.id,
          kitchenId: kitchen1,
          tierItems: { create: { tierId } },
        },
      })
    ).id;
    for (const roleName of [
      'OWNER',
      'MANAGER',
      'STAFF',
      'KITCHEN',
      'UNREVIEWED',
    ]) {
      const role = await prisma.role.upsert({
        where: { name: roleName },
        update: {},
        create: { name: roleName },
      });
      const user = await prisma.user.create({
        data: {
          username: username(roleName),
          fullName: roleName,
          roleId: role.id,
          passwordHash: await bcrypt.hash('security-test-only', 4),
        },
      });
      users[roleName] = user.id;
    }
    const grants = {
      OWNER: [...PERMISSIONS],
      MANAGER: [
        'orders.read',
        'orders.void',
        'void-logs.read',
        'invoices.read',
        'ingredients.read',
      ],
      STAFF: [
        'orders.read',
        'orders.write',
        'sessions.read',
        'sessions.write',
        'menu.read',
      ],
      KITCHEN: ['kitchens.read', 'kitchen.orders.read', 'kitchen.orders.write'],
    };
    const assignments = {
      [users.OWNER]: [kitchen1],
      [users.KITCHEN]: [kitchen1],
    };
    const configuration = (permissions: object) =>
      new ConfigService({
        ...process.env,
        STAFF_PERMISSION_GRANTS: JSON.stringify(permissions),
        KITCHEN_USER_ASSIGNMENTS: JSON.stringify(assignments),
        CUSTOMER_JWT_SECRET: customerKey,
      });
    async function createApp(permissions: object) {
      const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(ConfigService)
        .useValue(configuration(permissions))
        .compile();
      const instance =
        moduleRef.createNestApplication<INestApplication<Server>>();
      instance.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      instance.useGlobalInterceptors(new ResponseInterceptor());
      instance.useGlobalFilters(new AllExceptionsFilter());
      instance.enableCors(corsOptions);
      await instance.listen(0, '127.0.0.1');
      return instance;
    }
    app = await createApp(grants);
    defaultApp = await createApp({});
    origin = await app.getUrl();
    gateway = app.get(EventsGateway);
    for (const role of Object.keys(users)) {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: username(role), password: 'security-test-only' })
        .expect(200);
      tokens[role] = data<{ accessToken: string }>(response).accessToken;
    }
    async function makeSession() {
      const table = await prisma.table.create({
        data: { number: randomUUID() },
      });
      return prisma.session.create({
        data: {
          tableId: table.id,
          tierId,
          qrToken: randomUUID(),
          endTime: new Date(Date.now() + 3600000),
        },
      });
    }
    const rowA = await makeSession(),
      rowB = await makeSession();
    sessionA = rowA.id;
    sessionB = rowB.id;
    qrA = rowA.qrToken;
    a = data<Customer>(
      await request(app.getHttpServer()).get(`/sessions/qr/${qrA}`).expect(200),
    );
    b = data<Customer>(
      await request(app.getHttpServer())
        .get(`/sessions/qr/${rowB.qrToken}`)
        .expect(200),
    );
    const made = await prisma.order.create({
      data: {
        sessionId: sessionA,
        items: {
          create: { menuItemId: menuId, kitchenId: kitchen1, quantity: 1 },
        },
      },
      include: { items: true },
    });
    itemA = made.items[0].id;
  }, 30000);
  afterAll(async () => {
    sockets.forEach((socket) => socket.disconnect());
    if (app) await app.close();
    if (defaultApp) await defaultApp.close();
    if (prisma) await prisma.$disconnect();
  });
  function connection(
    auth: object,
    extraHeaders?: Record<string, string>,
  ): Promise<Socket> {
    const socket = io(origin, {
      auth,
      extraHeaders,
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
      autoConnect: false,
    });
    sockets.push(socket);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        socket.disconnect();
        reject(new Error('Socket connection timed out'));
      }, 2500);
      socket.once('connect', () => {
        clearTimeout(timeout);
        resolve(socket);
      });
      socket.once('connect_error', (error: Error) => {
        clearTimeout(timeout);
        socket.disconnect();
        reject(error);
      });
      socket.connect();
    });
  }
  function event<T>(
    socket: Socket,
    name: string,
    trigger: () => unknown,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const handler = (value: T) => {
        clearTimeout(timeout);
        resolve(value);
      };
      const timeout = setTimeout(() => {
        socket.off(name, handler);
        reject(new Error(`Missing ${name}`));
      }, 3000);
      socket.once(name, handler);
      void trigger();
    });
  }
  const auth = (role: string) => ({ accessToken: tokens[role] });
  const customer = (identity = a) => ({
    customerToken: identity.customerAccessToken,
  });

  it('default policy denies OWNER and every unapproved role; self profile still works', async () => {
    for (const role of Object.keys(tokens))
      await request(defaultApp.getHttpServer())
        .get('/users')
        .auth(tokens[role], { type: 'bearer' })
        .expect(403);
    await request(defaultApp.getHttpServer())
      .get('/auth/me')
      .auth(tokens.OWNER, { type: 'bearer' })
      .expect(200);
  });
  it.each([
    '/users',
    '/role',
    '/orders',
    '/sessions',
    '/invoices',
    '/ingredients',
    '/tables',
    '/kitchens',
    '/tiers',
    '/categories',
    '/menu-items',
    '/settings/payment',
  ])('anonymous staff endpoint %s returns 401', async (route) => {
    await request(app.getHttpServer()).get(route).expect(401);
  });
  it('configured OWNER can manage users/roles; STAFF/KITCHEN/MANAGER cannot escalate', async () => {
    for (const role of ['STAFF', 'KITCHEN', 'MANAGER', 'UNREVIEWED']) {
      await request(app.getHttpServer())
        .get('/users')
        .auth(tokens[role], { type: 'bearer' })
        .expect(403);
      await request(app.getHttpServer())
        .patch(`/users/${users[role]}`)
        .auth(tokens[role], { type: 'bearer' })
        .send({ roleId: 1 })
        .expect(403);
      await request(app.getHttpServer())
        .post('/role')
        .auth(tokens[role], { type: 'bearer' })
        .send({ name: randomUUID() })
        .expect(403);
    }
    await request(app.getHttpServer())
      .get('/users')
      .auth(tokens.OWNER, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .post('/role')
      .auth(tokens.OWNER, { type: 'bearer' })
      .send({ name: randomUUID() })
      .expect(201);
  });
  it('void/payment settings enforce distinct action permissions with positive and negative cases', async () => {
    await request(app.getHttpServer())
      .post(`/orders/items/${itemA}/void`)
      .auth(tokens.STAFF, { type: 'bearer' })
      .send({ reason: 'test' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/orders/items/${itemA}/status`)
      .auth(tokens.KITCHEN, { type: 'bearer' })
      .send({ status: 'VOIDED' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/orders/items/${itemA}/void`)
      .auth(tokens.MANAGER, { type: 'bearer' })
      .send({ reason: 'test approved' })
      .expect(201);
    expect(await prisma.voidLog.count({ where: { orderItemId: itemA } })).toBe(
      1,
    );
    await request(app.getHttpServer())
      .post('/settings/payment')
      .auth(tokens.MANAGER, { type: 'bearer' })
      .send({ promptPayNumber: 'test' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/settings/payment')
      .auth(tokens.OWNER, { type: 'bearer' })
      .send({ promptPayNumber: '0000000000' })
      .expect(201);
    await request(app.getHttpServer())
      .get('/orders/void-logs')
      .auth(tokens.MANAGER, { type: 'bearer' })
      .expect(200);
  });
  it('QR possession exchanges without staff login; legacy QR URLs work and response is minimal/no-store', async () => {
    const response = await request(app.getHttpServer())
      .get(`/sessions/qr/${qrA}`)
      .expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(Object.keys(data<object>(response)).sort()).toEqual(
      [
        'id',
        'status',
        'startTime',
        'endTime',
        'table',
        'tier',
        'customerAccessToken',
        'credentialExpiresAt',
      ].sort(),
    );
    expect(JSON.stringify(response.body)).not.toMatch(
      /priceAdult|priceChild|passwordHash|refreshToken|approvedBy|adultCount|qrToken/,
    );
    await request(app.getHttpServer())
      .get(`/sessions/qr/${randomUUID()}`)
      .expect(401);
  });
  it('sessionId alone or staff token cannot authorize customer access; customer token cannot authorize staff APIs', async () => {
    await request(app.getHttpServer())
      .get('/customer/orders')
      .query({ sessionId: sessionA })
      .expect(401);
    await request(app.getHttpServer())
      .post('/orders')
      .send({
        sessionId: sessionA,
        items: [{ menuItemId: menuId, quantity: 1 }],
      })
      .expect(401);
    await request(app.getHttpServer())
      .get('/customer/orders')
      .auth(tokens.OWNER, { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/orders')
      .auth(a.customerAccessToken, { type: 'bearer' })
      .expect(401);
    await request(app.getHttpServer())
      .get('/settings/payment')
      .auth(a.customerAccessToken, { type: 'bearer' })
      .expect(401);
  });
  it('customer A lists/creates only its own orders and cannot assert table B', async () => {
    const response = await request(app.getHttpServer())
      .post('/customer/orders')
      .auth(a.customerAccessToken, { type: 'bearer' })
      .send({ sessionId: a.id, items: [{ menuItemId: menuId, quantity: 1 }] })
      .expect(201);
    expect(data<{ sessionId: string }>(response).sessionId).toBe(sessionA);
    const list = await request(app.getHttpServer())
      .get('/customer/orders')
      .auth(a.customerAccessToken, { type: 'bearer' })
      .expect(200);
    expect(
      data<Array<{ sessionId: string }>>(list).every(
        (order) => order.sessionId === sessionA,
      ),
    ).toBe(true);
    await request(app.getHttpServer())
      .get('/customer/orders')
      .query({ sessionId: b.id })
      .auth(a.customerAccessToken, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/customer/orders')
      .auth(a.customerAccessToken, { type: 'bearer' })
      .send({
        sessionId: sessionB,
        items: [{ menuItemId: menuId, quantity: 1 }],
      })
      .expect(403);
    const menus = await request(app.getHttpServer())
      .get('/customer/menu-items')
      .auth(a.customerAccessToken, { type: 'bearer' })
      .expect(200);
    expect(JSON.stringify(menus.body)).not.toMatch(
      /priceAdult|priceChild|tierItems|currentStock|recipes/,
    );
  });
  it('rejects tampered signature, expired JWT, wrong audience and wrong signing domain', async () => {
    const original = jwt.decode<Record<string, unknown>>(a.customerAccessToken);
    const tokensToReject = [
      a.customerAccessToken.split('.').slice(0, 2).join('.') +
        '.' +
        'x'.repeat(43),
      jwt.sign(
        { ...original, exp: Math.floor(Date.now() / 1000) - 5 },
        { secret: customerKey, algorithm: 'HS256' },
      ),
      jwt.sign(
        { ...original, aud: 'wrong-audience' },
        { secret: customerKey, algorithm: 'HS256' },
      ),
      jwt.sign(original, {
        secret: process.env.JWT_SECRET,
        algorithm: 'HS256',
      }),
    ];
    for (const token of tokensToReject)
      await request(app.getHttpServer())
        .get('/customer/orders')
        .auth(token, { type: 'bearer' })
        .expect(401);
  });
  it('HTTP kitchen requests require assignment for listing and item updates', async () => {
    await request(app.getHttpServer())
      .get(`/orders/kitchen/${kitchen1}`)
      .auth(tokens.KITCHEN, { type: 'bearer' })
      .expect(200);
    await request(app.getHttpServer())
      .get(`/orders/kitchen/${kitchen2}`)
      .auth(tokens.KITCHEN, { type: 'bearer' })
      .expect(403);
    const otherMenu = await prisma.menuItem.create({
      data: {
        name: randomUUID(),
        kitchenId: kitchen2,
        categoryId: (await prisma.category.findFirstOrThrow()).id,
      },
    });
    const otherOrder = await prisma.order.create({
      data: {
        sessionId: sessionB,
        items: {
          create: {
            menuItemId: otherMenu.id,
            kitchenId: kitchen2,
            quantity: 1,
          },
        },
      },
      include: { items: true },
    });
    await request(app.getHttpServer())
      .patch(`/orders/items/${otherOrder.items[0].id}/status`)
      .auth(tokens.KITCHEN, { type: 'bearer' })
      .send({ status: 'PREPARING' })
      .expect(403);
  });
  it('Socket handshake rejects anonymous and forged credentials before connection', async () => {
    await expect(connection({})).rejects.toThrow();
    await expect(connection({ accessToken: 'forged' })).rejects.toThrow();
    await expect(connection({ customerToken: 'forged' })).rejects.toThrow();
    await expect(
      connection({ ...auth('OWNER'), ...customer() }),
    ).rejects.toThrow();
  });
  it('customer Socket cannot join cross-session/kitchen room but can receive own-session safe events', async () => {
    const client = await connection(customer());
    const denied = await event<{ statusCode: number }>(
      client,
      'exception',
      () => client.emit('session:join', { sessionId: b.id }),
    );
    expect(denied.statusCode).toBe(403);
    expect(
      gateway.server.sockets.sockets
        .get(client.id!)
        ?.rooms.has(`session:${sessionB}`),
    ).toBe(false);
    expect(
      (
        await event<{ statusCode: number }>(client, 'exception', () =>
          client.emit('kitchen:join', { kitchenId: kitchen1 }),
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await event<{ room: string }>(client, 'session:joined', () =>
          client.emit('session:join', { sessionId: a.id }),
        )
      ).room,
    ).toBe(`session:${sessionA}`);
    const payload = await event<{ sessionId: string }>(
      client,
      'order:status_changed',
      () =>
        gateway.emitOrderStatus(sessionA, {
          id: randomUUID(),
          sessionId: sessionA,
          status: 'PENDING',
          invoice: { netAmount: 999 },
          user: { fullName: 'SECRET' },
        } as Parameters<EventsGateway['emitOrderStatus']>[1]),
    );
    expect(payload.sessionId).toBe(sessionA);
    expect(JSON.stringify(payload)).not.toMatch(
      /invoice|netAmount|SECRET|user/,
    );
  });
  it('staff Socket kitchen joins enforce assignment and role action', async () => {
    const client = await connection(auth('KITCHEN'));
    expect(
      (
        await event<{ room: string }>(client, 'kitchen:joined', () =>
          client.emit('kitchen:join', { kitchenId: kitchen1 }),
        )
      ).room,
    ).toBe(`kitchen:${kitchen1}`);
    expect(
      (
        await event<{ statusCode: number }>(client, 'exception', () =>
          client.emit('kitchen:join', { kitchenId: kitchen2 }),
        )
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await event<{ statusCode: number }>(client, 'exception', () =>
          client.emit('session:join', { sessionId: a.id }),
        )
      ).statusCode,
    ).toBe(403);
  });
  it('invoice/stock events reach authorized staff but never customer or ordinary STAFF sockets', async () => {
    const owner = await connection(auth('OWNER')),
      buyer = await connection(customer()),
      staff = await connection(auth('STAFF'));
    const leaks: unknown[] = [];
    buyer.on('invoice:new', (value) => leaks.push(value));
    buyer.on('ingredient:low_stock', (value) => leaks.push(value));
    staff.on('invoice:new', (value) => leaks.push(value));
    staff.on('ingredient:low_stock', (value) => leaks.push(value));
    await event(owner, 'invoice:new', () =>
      gateway.emitNewInvoice({
        invoiceId: randomUUID(),
        netAmount: 100,
        paymentMethod: 'CASH',
        tableNumber: 'TEST',
        createdAt: new Date(),
      }),
    );
    await event(owner, 'ingredient:low_stock', () =>
      gateway.emitLowStock({
        ingredientId: 1,
        name: 'TEST',
        currentStock: 0,
        unit: 'g',
        isEmpty: true,
      }),
    );
    expect(leaks).toEqual([]);
  });
  it('Socket reconnect re-authenticates; expired JWT disconnects existing sockets', async () => {
    const client = await connection(customer());
    client.disconnect();
    client.auth = { customerToken: 'forged-after-first-connect' };
    await expect(
      event(client, 'connect_error', () => client.connect()),
    ).resolves.toBeInstanceOf(Error);
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: users.OWNER },
    });
    const short = jwt.sign(
      { sub: user.id, username: user.username, kind: 'access' },
      { secret: process.env.JWT_SECRET, expiresIn: 2, algorithm: 'HS256' },
    );
    const expiring = await connection({ accessToken: short });
    await event(expiring, 'disconnect', () => undefined);
    expect(expiring.connected).toBe(false);
  });
  it('closed/expired sessions reject HTTP, Socket handshake and rejoin; legacy QR binding revokes on rotation', async () => {
    const client = await connection(customer(b));
    const rejoining = await connection(customer(b));
    await event(client, 'session:joined', () =>
      client.emit('session:join', { sessionId: b.id }),
    );
    await prisma.session.update({
      where: { id: sessionB },
      data: { status: 'CLOSED' },
    });
    await request(app.getHttpServer())
      .get('/customer/orders')
      .auth(b.customerAccessToken, { type: 'bearer' })
      .expect(403);
    await expect(connection(customer(b))).rejects.toThrow();
    await event(rejoining, 'disconnect', () =>
      rejoining.emit('session:join', { sessionId: b.id }),
    );
    await event(client, 'disconnect', () =>
      gateway.emitSessionWarning(sessionB, 1),
    );
    await prisma.session.update({
      where: { id: sessionB },
      data: { status: 'ACTIVE', endTime: new Date(Date.now() - 1000) },
    });
    await request(app.getHttpServer())
      .get('/customer/orders')
      .auth(b.customerAccessToken, { type: 'bearer' })
      .expect(403);
    await expect(connection(customer(b))).rejects.toThrow();
    await prisma.session.update({
      where: { id: sessionA },
      data: { qrToken: randomUUID() },
    });
    await request(app.getHttpServer())
      .get('/customer/orders')
      .auth(a.customerAccessToken, { type: 'bearer' })
      .expect(401);
  });
  it('inactive staff is revoked on HTTP and on sensitive event delivery for an existing socket', async () => {
    const owner = await connection(auth('OWNER'));
    await prisma.user.update({
      where: { id: users.OWNER },
      data: { isActive: false },
    });
    await request(app.getHttpServer())
      .get('/users')
      .auth(tokens.OWNER, { type: 'bearer' })
      .expect(401);
    await event(owner, 'disconnect', () =>
      gateway.emitNewInvoice({
        invoiceId: randomUUID(),
        netAmount: 1,
        paymentMethod: 'CASH',
        tableNumber: 'TEST',
        createdAt: new Date(),
      }),
    );
    await expect(connection(auth('OWNER'))).rejects.toThrow();
    await prisma.user.update({
      where: { id: users.OWNER },
      data: { isActive: true },
    });
  });
  it('CORS is an explicit origin allowlist for browser HTTP and WebSocket', async () => {
    const allowed = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Origin', 'http://localhost:3001')
      .auth(tokens.OWNER, { type: 'bearer' })
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:3001',
    );
    const denied = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Origin', 'https://untrusted.example')
      .auth(tokens.OWNER, { type: 'bearer' })
      .expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
    await expect(
      connection(auth('OWNER'), { Origin: 'https://untrusted.example' }),
    ).rejects.toThrow();
  });
  it('Swagger marks staff and customer routes with separate bearer schemes', () => {
    const config = new DocumentBuilder()
      .addBearerAuth(undefined, 'JWT')
      .addBearerAuth(undefined, 'Customer')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    expect(document.paths['/orders'].get?.security).toEqual(
      expect.arrayContaining([{ JWT: [] }]),
    );
    expect(document.paths['/customer/orders'].get?.security).toEqual(
      expect.arrayContaining([{ Customer: [] }]),
    );
  });
});
