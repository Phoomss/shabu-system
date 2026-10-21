import { ConfigService } from '@nestjs/config';
import { PERMISSIONS } from '../src/security/policy';
import { randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { io, Socket } from '../../frontend/node_modules/socket.io-client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { SessionsService } from '../src/sessions/sessions.service';
import { EventsGateway } from '../src/events/events.gateway';
import { ResponseInterceptor } from '../src/common/response.interceptor';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import {
  IdPrefix,
  IdTransformer,
} from '../src/common/utils/id-transformer.util';
import { SessionStatus } from '@prisma/client';

// This suite must never run against a developer's normal DATABASE_URL.
const target = new URL(
  process.env.DATABASE_URL || 'postgresql://invalid/invalid',
);
if (
  process.env.ALLOW_SHABU_TEST_DB !== '1' ||
  target.hostname !== '127.0.0.1' ||
  target.port !== '55432' ||
  !/^\/shabu_f04_empty_\d+$/.test(target.pathname)
) {
  throw new Error(
    'Use the fresh isolated database from test:migrations with explicit opt-in',
  );
}

type WireSession = {
  id: string;
  tableId: string;
  qrToken: string;
  table: { status: string };
};
type WireOrder = { id: string; sessionId: string };
function data<T>(response: request.Response): T {
  return (response.body as { data: T }).data;
}

describe('ID contract against migrated PostgreSQL + HTTP + Socket', () => {
  let app: INestApplication<Server>;
  let prisma: PrismaService;
  let sessions: SessionsService;
  let gateway: EventsGateway;
  let token: string;
  let tierId: number;
  let menuId: string;
  let origin: string;
  const clients: Socket[] = [];
  const ids = new IdTransformer();
  const marker = randomUUID();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          ...process.env,
          STAFF_PERMISSION_GRANTS: JSON.stringify({
            [`TEST-${marker}`]: [...PERMISSIONS],
          }),
          KITCHEN_USER_ASSIGNMENTS: '{}',
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
    prisma = app.get(PrismaService);
    sessions = app.get(SessionsService);
    gateway = app.get(EventsGateway);
    const role = await prisma.role.create({ data: { name: `TEST-${marker}` } });
    await prisma.user.create({
      data: {
        username: marker,
        fullName: 'ID Test User',
        roleId: role.id,
        passwordHash: await bcrypt.hash('local-test-only', 4),
      },
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: marker, password: 'local-test-only' })
      .expect(200);
    token = data<{ accessToken: string }>(login).accessToken;
    const tier = await prisma.tier.create({
      data: { name: marker, priceAdult: 100, priceChild: 50 },
    });
    tierId = tier.id;
    const category = await prisma.category.create({ data: { name: marker } });
    const kitchen = await prisma.kitchenSection.create({
      data: { name: marker },
    });
    const menu = await prisma.menuItem.create({
      data: {
        name: marker,
        kitchenId: kitchen.id,
        categoryId: category.id,
        tierItems: { create: { tierId } },
      },
    });
    menuId = menu.id;
  }, 30000);

  afterAll(async () => {
    clients.forEach((client) => client.disconnect());
    if (app) await app.close();
  });

  async function openTable(prefix = 'TABLE') {
    const table = await prisma.table.create({
      data: { number: `${prefix}-${randomUUID()}` },
    });
    const opened = await request(app.getHttpServer())
      .post('/sessions')
      .auth(token, { type: 'bearer' })
      .send({ tableId: table.id, tierId, adultCount: 1, childCount: 0 })
      .expect(201);
    const wire = data<WireSession>(opened);
    return { table, wire, raw: ids.decode(wire.id, IdPrefix.SESSION) };
  }

  it('opens table -> resolves QR -> orders/lists using the exact HTTP session ID and raw alias', async () => {
    const { wire, raw, table } = await openTable();
    expect(wire.id).toMatch(/^ses_[0-9a-f]{32}$/);
    expect(wire.tableId).toBe(ids.encodeInt(table.id, IdPrefix.TABLE));
    const qr = await request(app.getHttpServer())
      .get(`/sessions/qr/${wire.qrToken}`)
      .expect(200);
    expect(data<WireSession>(qr).id).toBe(wire.id);
    const customerToken = data<{ customerAccessToken: string }>(
      qr,
    ).customerAccessToken;
    for (const sessionId of [wire.id, raw]) {
      const made = await request(app.getHttpServer())
        .post('/customer/orders')
        .auth(customerToken, { type: 'bearer' })
        .send({ sessionId, items: [{ menuItemId: menuId, quantity: 1 }] })
        .expect(201);
      const history = await request(app.getHttpServer())
        .get('/customer/orders')
        .auth(customerToken, { type: 'bearer' })
        .query({ sessionId })
        .expect(200);
      expect(
        data<WireOrder[]>(history).some(
          (order: { id: string }) => order.id === data<WireOrder>(made).id,
        ),
      ).toBe(true);
      expect(data<WireOrder>(made).sessionId).toBe(raw);
      await request(app.getHttpServer())
        .get(`/orders/${ids.encode(data<WireOrder>(made).id, IdPrefix.ORDER)}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
    }
  });

  it('returns 400 for malformed/wrong-entity IDs and 404 for well-formed nonexistent PKs', async () => {
    const missing = randomUUID();
    for (const id of [
      'ses_bad',
      'SES-000001',
      ids.encode(missing, IdPrefix.INVOICE),
    ]) {
      await request(app.getHttpServer())
        .get(`/sessions/${id}`)
        .auth(token, { type: 'bearer' })
        .expect(400);
      await request(app.getHttpServer())
        .get('/orders')
        .auth(token, { type: 'bearer' })
        .query({ sessionId: id })
        .expect(400);
    }
    await request(app.getHttpServer())
      .get(`/sessions/${ids.encode(missing, IdPrefix.SESSION)}`)
      .auth(token, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .get(`/orders/${ids.encode(missing, IdPrefix.ORDER)}`)
      .auth(token, { type: 'bearer' })
      .expect(404);
    await request(app.getHttpServer())
      .get('/orders')
      .auth(token, { type: 'bearer' })
      .query({ sessionId: missing })
      .expect(404);
    await request(app.getHttpServer())
      .get('/invoices/inv_bad')
      .auth(token, { type: 'bearer' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/invoices/${ids.encode(missing, IdPrefix.INVOICE)}`)
      .auth(token, { type: 'bearer' })
      .expect(404);
  });

  it('closes session and sets its real integer table PK to CLEANING together', async () => {
    const { wire, raw, table } = await openTable();
    const response = await request(app.getHttpServer())
      .patch(`/sessions/${wire.id}/status`)
      .auth(token, { type: 'bearer' })
      .send({ status: 'CLOSED' })
      .expect(200);
    expect(data<WireSession>(response).table.status).toBe('CLEANING');
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: raw } })).status,
    ).toBe('CLOSED');
    expect(
      (await prisma.table.findUniqueOrThrow({ where: { id: table.id } }))
        .status,
    ).toBe('CLEANING');
  });

  it('rolls back the table update and emits no success if the session write fails', async () => {
    const { wire, raw, table } = await openTable();
    // Generated UUID literal only; trigger exists solely in this isolated test DB.
    await prisma.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION reject_test_session_close() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test write failure'; END $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER reject_test_close_${raw.replace(/-/g, '')} BEFORE UPDATE ON "Session" FOR EACH ROW WHEN (NEW.id = '${raw}' AND NEW.status = 'CLOSED') EXECUTE FUNCTION reject_test_session_close()`,
    );
    const status = jest.spyOn(gateway, 'emitSessionStatus');
    const tableStatus = jest.spyOn(gateway, 'emitTableStatus');
    await request(app.getHttpServer())
      .patch(`/sessions/${wire.id}/status`)
      .auth(token, { type: 'bearer' })
      .send({ status: 'CLOSED' })
      .expect(500);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: raw } })).status,
    ).toBe('ACTIVE');
    expect(
      (await prisma.table.findUniqueOrThrow({ where: { id: table.id } }))
        .status,
    ).toBe('OCCUPIED');
    expect(status).not.toHaveBeenCalled();
    expect(tableStatus).not.toHaveBeenCalled();
    status.mockRestore();
    tableStatus.mockRestore();
  });

  it('cron expires session/table consistently with only one session event', async () => {
    const { raw, table } = await openTable();
    await prisma.session.update({
      where: { id: raw },
      data: { endTime: new Date(Date.now() - 60000) },
    });
    const status = jest.spyOn(gateway, 'emitSessionStatus');
    await sessions.checkSessionTime();
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: raw } })).status,
    ).toBe(SessionStatus.EXPIRED);
    expect(
      (await prisma.table.findUniqueOrThrow({ where: { id: table.id } }))
        .status,
    ).toBe('CLEANING');
    expect(status.mock.calls.filter(([id]) => id === raw)).toHaveLength(1);
    status.mockRestore();
  });

  it('raw and REST-prefixed Socket join receive the same service events', async () => {
    const { wire, raw } = await openTable();
    for (const sessionId of [raw, wire.id]) {
      const client = io(origin, {
        auth: { accessToken: token },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });
      clients.push(client);
      await new Promise<void>((resolve, reject) => {
        client.once('connect', () => resolve());
        client.once('connect_error', reject);
      });
      const joined = new Promise<{ room: string }>((resolve) =>
        client.once('session:joined', resolve),
      );
      client.emit('session:join', { sessionId });
      const ack = await joined;
      expect(ack.room).toBe(`session:${raw}`);
      const event = new Promise<{ sessionId: string; minutesLeft: number }>(
        (resolve) => client.once('session:time_warning', resolve),
      );
      gateway.emitSessionWarning(raw, 15);
      expect(await event).toEqual({ sessionId: raw, minutesLeft: 15 });
      client.disconnect();
    }
  });
});
