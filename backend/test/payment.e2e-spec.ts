import { randomUUID } from 'node:crypto';
import { spawn, ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { openSync, closeSync } from 'node:fs';
import { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
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

const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid');
if (
  process.env.ALLOW_SHABU_TEST_DB !== '1' ||
  url.hostname !== '127.0.0.1' ||
  url.port !== '55432' ||
  !/^\/shabu_payment_empty_\d+$/.test(url.pathname)
)
  throw new Error('Isolated payment test DB opt-in required');
const data = <T>(response: request.Response) =>
  (response.body as { data: T }).data;
type WireSession = {
  id: string;
  tableId: string;
  qrToken: string;
  status: string;
};
const ids = new IdTransformer();

describe('Payment safety foundation; approved checkout remains BLOCKED', () => {
  let app: INestApplication<Server>, prisma: PrismaService, tierId: number;
  const marker = randomUUID(),
    grants: Record<string, string[]> = {},
    tokens: Record<string, string> = {},
    actors: Record<string, string> = {};
  const api = () => request(app.getHttpServer());
  const authorize = (role = 'WRITER') => tokens[role];
  const open = (
    tableId: number,
    key?: string,
    role = 'WRITER',
    counts = { adultCount: 2, childCount: 1 },
  ) => {
    const call = api()
      .post('/sessions')
      .auth(authorize(role), { type: 'bearer' });
    if (key !== undefined) call.set('Idempotency-Key', key);
    return call.send({ tableId, tierId, ...counts });
  };
  const newTable = async () =>
    (await prisma.table.create({ data: { number: randomUUID() } })).id;
  const invoice = (
    sessionId: string,
    totalAmount = 0.01,
    discount = 0,
    role = 'WRITER',
  ) =>
    api().post('/invoices').auth(authorize(role), { type: 'bearer' }).send({
      sessionId,
      totalAmount,
      discount,
      paymentMethod: 'QR_CODE',
      promptPayNumber: 'not-a-payment-payload',
    });
  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();
    tierId = (
      await prisma.tier.create({
        data: { name: marker, priceAdult: '0.10', priceChild: '0.20' },
      })
    ).id;
    for (const name of ['WRITER', 'DISCOUNTER', 'READER']) {
      const role = await prisma.role.create({
        data: { name: `${marker}-${name}` },
      });
      actors[name] = (
        await prisma.user.create({
          data: {
            username: `${marker}-${name}`,
            fullName: name,
            roleId: role.id,
            passwordHash: 'unused-test-fixture',
          },
        })
      ).id;
      grants[role.name] =
        name === 'READER'
          ? ['invoices.read']
          : [
              'invoices.read',
              'invoices.write',
              'sessions.read',
              'sessions.write',
              'payment-settings.read',
              'payment-settings.write',
              ...(name === 'DISCOUNTER' ? ['invoices.discount'] : []),
            ];
      tokens[name] = new JwtService().sign(
        { sub: actors[name], kind: 'access' },
        { secret: process.env.JWT_SECRET, algorithm: 'HS256', expiresIn: '1h' },
      );
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          ...process.env,
          STAFF_PERMISSION_GRANTS: JSON.stringify(grants),
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
  }, 30000);
  afterAll(async () => {
    if (app) await app.close();
    if (prisma) await prisma.$disconnect();
  });

  it('readiness route precedes dynamic id and cannot imply PAID or provide a guessed quote', async () => {
    const ready = data<{
      checkoutEnabled: boolean;
      qrEnabled: boolean;
      confirmationEnabled: boolean;
      code: string;
    }>(
      await api()
        .get('/invoices/payment-readiness')
        .auth(authorize('READER'), { type: 'bearer' })
        .expect(200),
    );
    expect(ready).toMatchObject({
      checkoutEnabled: false,
      qrEnabled: false,
      confirmationEnabled: false,
      code: 'CHECKOUT_POLICY_PENDING',
    });
    expect(ready).not.toHaveProperty('totalAmount');
  });
  it('anonymous/wrong permission/discount without explicit grant are denied', async () => {
    const table = await newTable(),
      session = data<WireSession>(await open(table).expect(201));
    await api().post('/invoices').send({}).expect(401);
    await invoice(session.id, 0.01, 0, 'READER').expect(403);
    await invoice(session.id, 1, 0.01).expect(403);
    await api()
      .post('/settings/payment')
      .send({ promptPayNumber: 'fixture' })
      .expect(401);
    await api()
      .post('/settings/payment')
      .auth(authorize('READER'), { type: 'bearer' })
      .send({ promptPayNumber: 'fixture' })
      .expect(403);
  });
  it('tampering totals, excessive discounts, repeated/concurrent checkout cannot write anything while policy is pending', async () => {
    const tableId = await newTable(),
      session = data<WireSession>(await open(tableId).expect(201)),
      raw = ids.decode(session.id, IdPrefix.SESSION);
    const gateway = app.get(EventsGateway),
      emit = jest.spyOn(gateway, 'emitNewInvoice');
    const before = await prisma.invoice.count();
    for (const total of [0, 0.01, 999999])
      await invoice(session.id, total).expect(503);
    await invoice(session.id, 1, 999999, 'DISCOUNTER').expect(503);
    const results = await Promise.all([
      invoice(session.id),
      invoice(session.id),
    ]);
    expect(results.map((row) => row.status)).toEqual([503, 503]);
    expect((results[0].body as { message: string }).message).toContain(
      'CHECKOUT_POLICY_PENDING',
    );
    expect(await prisma.invoice.count()).toBe(before);
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: raw } })).status,
    ).toBe('ACTIVE');
    expect(
      (await prisma.table.findUniqueOrThrow({ where: { id: tableId } })).status,
    ).toBe('OCCUPIED');
    expect(emit).not.toHaveBeenCalled();
    emit.mockRestore();
  });
  it('two concurrent opening requests claim one session; database constraint also rejects direct duplicate ACTIVE insertion', async () => {
    const tableId = await newTable();
    const responses = await Promise.all([open(tableId), open(tableId)]);
    expect(responses.map((res) => res.status).sort()).toEqual([201, 409]);
    expect(
      await prisma.session.count({ where: { tableId, status: 'ACTIVE' } }),
    ).toBe(1);
    await expect(
      prisma.session.create({
        data: {
          tableId,
          tierId,
          qrToken: randomUUID(),
          endTime: new Date(Date.now() + 3600000),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('same opening key retries concurrently as one resource; different input conflicts without claiming another table', async () => {
    const tableId = await newTable(),
      other = await newTable(),
      key = randomUUID();
    const gateway = app.get(EventsGateway),
      emit = jest.spyOn(gateway, 'emitTableStatus');
    const responses = await Promise.all([
      open(tableId, key),
      open(tableId, key),
    ]);
    expect(responses.map((res) => res.status)).toEqual([201, 201]);
    expect(data<WireSession>(responses[0]).id).toBe(
      data<WireSession>(responses[1]).id,
    );
    expect(await prisma.session.count({ where: { tableId } })).toBe(1);
    expect(emit).toHaveBeenCalledTimes(1);
    emit.mockRestore();
    await open(other, key).expect(409);
    expect(
      (await prisma.table.findUniqueOrThrow({ where: { id: other } })).status,
    ).toBe('AVAILABLE');
    await open(other, 'bad key with spaces').expect(400);
  });
  it('idempotency keys are actor-scoped and key replay never opens a fresh session after closure', async () => {
    const key = randomUUID(),
      table = await newTable(),
      other = await newTable();
    const first = data<WireSession>(await open(table, key).expect(201));
    await app.get(SessionsService).updateStatus(first.id, { status: 'CLOSED' });
    const replay = data<WireSession>(await open(table, key).expect(201));
    expect(replay.id).toBe(first.id);
    expect(replay.status).toBe('CLOSED');
    await prisma.table.update({
      where: { id: table },
      data: { status: 'AVAILABLE' },
    });
    await open(table, randomUUID()).expect(409);
    await open(other, key, 'DISCOUNTER').expect(201);
    expect(await prisma.session.count({ where: { tableId: table } })).toBe(1);
  });
  it('session insert failure rolls back table claim and idempotency row, and emits no OCCUPIED', async () => {
    const tableId = await newTable(),
      key = randomUUID(),
      gateway = app.get(EventsGateway),
      emit = jest.spyOn(gateway, 'emitTableStatus');
    await prisma.$executeRawUnsafe(
      `CREATE OR REPLACE FUNCTION payment_fail_open() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."tableId" = ${tableId} THEN RAISE EXCEPTION 'payment session fixture failure'; END IF; RETURN NEW; END $$`,
    );
    await prisma.$executeRawUnsafe(
      'CREATE TRIGGER payment_fail_open BEFORE INSERT ON "Session" FOR EACH ROW EXECUTE FUNCTION payment_fail_open()',
    );
    try {
      await open(tableId, key).expect(500);
      expect(
        (await prisma.table.findUniqueOrThrow({ where: { id: tableId } }))
          .status,
      ).toBe('AVAILABLE');
      expect(await prisma.session.count({ where: { tableId } })).toBe(0);
      expect(await prisma.sessionOpenRequest.count({ where: { key } })).toBe(0);
      expect(emit).not.toHaveBeenCalled();
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER payment_fail_open ON "Session"',
      );
      await prisma.$executeRawUnsafe('DROP FUNCTION payment_fail_open()');
      emit.mockRestore();
    }
    await open(tableId, key).expect(201);
  });
  it.each([-1, 2147483648, 1.5])(
    'rejects invalid guest count %s before opening',
    async (count) => {
      const tableId = await newTable();
      await open(tableId, undefined, 'WRITER', {
        adultCount: count,
        childCount: 0,
      }).expect(400);
      expect(
        (await prisma.table.findUniqueOrThrow({ where: { id: tableId } }))
          .status,
      ).toBe('AVAILABLE');
    },
  );
  it('expired session cannot order or be overlapped, but approved overdue checkout is still BLOCKED', async () => {
    const tableId = await newTable(),
      wire = data<WireSession>(await open(tableId).expect(201)),
      raw = ids.decode(wire.id, IdPrefix.SESSION);
    const qr = data<{ customerAccessToken: string }>(
      await api().get(`/sessions/qr/${wire.qrToken}`).expect(200),
    );
    await prisma.session.update({
      where: { id: raw },
      data: { endTime: new Date(Date.now() - 1000) },
    });
    await api()
      .post('/customer/orders')
      .auth(qr.customerAccessToken, { type: 'bearer' })
      .send({ items: [] })
      .expect(403);
    await app.get(SessionsService).checkSessionTime();
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: raw } })).status,
    ).toBe('EXPIRED');
    // Legacy cron still assigns CLEANING; that unresolved state machine is characterized, not approved here.
    expect(
      (await prisma.table.findUniqueOrThrow({ where: { id: tableId } })).status,
    ).toBe('CLEANING');
    await prisma.table.update({
      where: { id: tableId },
      data: { status: 'AVAILABLE' },
    });
    await open(tableId).expect(409);
    await invoice(wire.id).expect(503);
  });
  it('historical stored decimals are unchanged by current tier price edits; no retrospective repricing', async () => {
    const tableId = await newTable(),
      wire = data<WireSession>(await open(tableId).expect(201));
    const row = await prisma.invoice.create({
      data: {
        sessionId: ids.decode(wire.id, IdPrefix.SESSION),
        totalAmount: '0.50',
        discount: '0.20',
        netAmount: '0.30',
        paymentMethod: 'LEGACY_UNVERIFIED',
        createdBy: actors.WRITER,
      },
    });
    await prisma.tier.update({
      where: { id: tierId },
      data: { priceAdult: '99999.99' },
    });
    const response = data<{
      totalAmount: string;
      discount: string;
      netAmount: string;
    }>(
      await api()
        .get(`/invoices/${row.id}`)
        .auth(authorize(), { type: 'bearer' })
        .expect(200),
    );
    expect([
      response.totalAmount,
      response.discount,
      response.netAmount,
    ]).toEqual(['0.5', '0.2', '0.3']);
    await app.get(SessionsService).updateStatus(wire.id, { status: 'CLOSED' });
    await prisma.table.update({
      where: { id: tableId },
      data: { status: 'AVAILABLE' },
    });
    await open(tableId).expect(409); // Invoice existence is not verified settlement.
  });
  it.each([
    {},
    { promptPayNumber: '' },
    { promptPayNumber: 42 },
    { promptPayNumber: 'x'.repeat(65) },
    { promptPayNumber: 'bad\u0000reference' },
  ])('rejects invalid settings input %j', async (payload) => {
    await api()
      .post('/settings/payment')
      .auth(authorize(), { type: 'bearer' })
      .send(payload)
      .expect(400);
  });
  it('settings persist with authenticated updater; explicit null clears config', async () => {
    await api()
      .post('/settings/payment')
      .auth(authorize(), { type: 'bearer' })
      .send({ promptPayNumber: '  fixture-unverified-receiver  ' })
      .expect(201);
    const row = await prisma.paymentSettings.findUniqueOrThrow({
      where: { id: 1 },
    });
    expect(row.promptPayNumber).toBe('fixture-unverified-receiver');
    expect(row.updatedBy).toBe(actors.WRITER);
    await api()
      .post('/settings/payment')
      .auth(authorize(), { type: 'bearer' })
      .send({ promptPayNumber: null })
      .expect(201);
    expect(
      data<{ promptPayNumber: null }>(
        await api()
          .get('/settings/payment')
          .auth(authorize(), { type: 'bearer' })
          .expect(200),
      ).promptPayNumber,
    ).toBeNull();
  });
  it('settings survive actual backend process stop/start; readiness remains disabled', async () => {
    async function start() {
      const probe = createServer();
      await new Promise<void>((resolve) =>
        probe.listen(0, '127.0.0.1', resolve),
      );
      const port = (probe.address() as { port: number }).port;
      await new Promise<void>((resolve) => probe.close(() => resolve()));
      const log = openSync(
        process.env.SHABU_TEST_ARTIFACT_DIR
          ? `${process.env.SHABU_TEST_ARTIFACT_DIR}/restart-process.log`
          : '../reports/payment-evidence/restart-process.log',
        'a',
      );
      const child = spawn(
        process.execPath,
        ['-r', './register-paths.cjs', 'dist/main.js'],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            PORT: String(port),
            NODE_ENV: 'test',
            STAFF_PERMISSION_GRANTS: JSON.stringify(grants),
            KITCHEN_USER_ASSIGNMENTS: '{}',
          },
          stdio: ['ignore', log, log],
        },
      );
      closeSync(log);
      const address = `http://127.0.0.1:${port}`;
      for (let attempt = 0; attempt < 60; attempt++) {
        if (child.exitCode !== null)
          throw new Error(`Backend exited ${child.exitCode}`);
        try {
          if ((await fetch(address + '/api-docs')).status === 200)
            return { child, address };
        } catch {
          /* wait for boot */
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      child.kill('SIGTERM');
      throw new Error('Backend startup timeout');
    }
    async function stop(child: ChildProcess) {
      const exited = new Promise((resolve) => child.once('exit', resolve));
      child.kill('SIGTERM');
      await exited;
    }
    const first = await start();
    try {
      expect(
        (
          await fetch(first.address + '/settings/payment', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authorize()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              promptPayNumber: 'restart-fixture-unverified',
            }),
          })
        ).status,
      ).toBe(201);
    } finally {
      await stop(first.child);
    }
    const second = await start();
    try {
      const response = await fetch(second.address + '/settings/payment', {
        headers: { Authorization: `Bearer ${authorize()}` },
      });
      expect(response.status).toBe(200);
      expect(
        ((await response.json()) as { data: { promptPayNumber: string } }).data
          .promptPayNumber,
      ).toBe('restart-fixture-unverified');
      const ready = await fetch(
        second.address + '/invoices/payment-readiness',
        { headers: { Authorization: `Bearer ${authorize()}` } },
      );
      expect(
        ((await ready.json()) as { data: { confirmationEnabled: boolean } })
          .data.confirmationEnabled,
      ).toBe(false);
    } finally {
      await stop(second.child);
    }
  }, 20000);
});
