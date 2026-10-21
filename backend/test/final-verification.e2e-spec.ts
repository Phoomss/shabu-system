import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Server } from 'node:http';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ResponseInterceptor } from '../src/common/response.interceptor';
import { AllExceptionsFilter } from '../src/common/all-exceptions.filter';
import { PERMISSIONS } from '../src/security/policy';
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
  !/^\/shabu_final_\d+$/.test(target.pathname)
)
  throw Error('Isolated final verification DB required');
const ids = new IdTransformer();
const data = <T>(response: request.Response): T =>
  (response.body as { data: T }).data;
type WireSession = { id: string; qrToken: string; status: string };
type Customer = { id: string; customerAccessToken: string };
type Order = { id: string; items: { id: string; status: string }[] };

describe('Final acceptance probes — real HTTP/JWT/PostgreSQL; synthetic fixtures only', () => {
  const prisma = new PrismaService();
  const marker = randomUUID(),
    roleName = `FINAL-FIXTURE-${marker}`;
  let app: INestApplication<Server>,
    token: string,
    tier: number,
    kitchen: number,
    menu: string;
  const facts: { caseId: string; actual: unknown }[] = [];
  const record = (caseId: string, actual: unknown) => {
    facts.push({ caseId, actual });
    if (process.env.SHABU_TEST_ARTIFACT_DIR)
      writeFileSync(
        join(process.env.SHABU_TEST_ARTIFACT_DIR, 'journey-facts.json'),
        JSON.stringify(facts, null, 2),
      );
  };
  const api = () => request(app.getHttpServer());
  const staff = (route: request.Test) => route.auth(token, { type: 'bearer' });
  beforeAll(async () => {
    await prisma.$connect();
    const role = await prisma.role.create({ data: { name: roleName } });
    const actor = await prisma.user.create({
      data: {
        roleId: role.id,
        username: marker,
        fullName: 'Final fixture actor',
        passwordHash: await bcrypt.hash('final-fixture-only', 4),
      },
    });
    kitchen = (await prisma.kitchenSection.create({ data: { name: marker } }))
      .id;
    const category = await prisma.category.create({ data: { name: marker } });
    tier = (
      await prisma.tier.create({
        data: { name: marker, priceAdult: '399.10', priceChild: '199.05' },
      })
    ).id;
    menu = (
      await prisma.menuItem.create({
        data: {
          name: 'Visible fixture menu',
          categoryId: category.id,
          kitchenId: kitchen,
          tierItems: { create: { tierId: tier } },
        },
      })
    ).id;
    await prisma.menuItem.create({
      data: {
        name: 'Unavailable fixture menu',
        isAvailable: false,
        categoryId: category.id,
        kitchenId: kitchen,
        tierItems: { create: { tierId: tier } },
      },
    });
    await prisma.menuItem.create({
      data: {
        name: 'Outside-tier fixture menu',
        categoryId: category.id,
        kitchenId: kitchen,
      },
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          ...process.env,
          STAFF_PERMISSION_GRANTS: JSON.stringify({
            [roleName]: [...PERMISSIONS],
          }),
          KITCHEN_USER_ASSIGNMENTS: JSON.stringify({ [actor.id]: [kitchen] }),
        }),
      )
      .compile();
    app = module.createNestApplication<INestApplication<Server>>();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseInterceptor());
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.listen(0, '127.0.0.1');
    token = data<{ accessToken: string }>(
      await api()
        .post('/auth/login')
        .send({ username: marker, password: 'final-fixture-only' })
        .expect(200),
    ).accessToken;
  });
  afterAll(async () => {
    await app?.close();
    await prisma.$disconnect();
  });
  async function open() {
    const table = data<{ id: number }>(
      await staff(api().post('/tables'))
        .send({ number: randomUUID() })
        .expect(201),
    );
    const session = data<WireSession>(
      await staff(api().post('/sessions'))
        .set('Idempotency-Key', randomUUID())
        .send({ tableId: table.id, tierId: tier, adultCount: 2, childCount: 1 })
        .expect(201),
    );
    const customer = data<Customer>(
      await api().get(`/sessions/qr/${session.qrToken}`).expect(200),
    );
    return {
      table,
      session,
      customer,
      raw: ids.decode(session.id, IdPrefix.SESSION),
    };
  }
  const place = (customer: Customer, key?: string) => {
    const call = api()
      .post('/customer/orders')
      .auth(customer.customerAccessToken, { type: 'bearer' });
    if (key) call.set('Idempotency-Key', key);
    return call.send({ items: [{ menuItemId: menu, quantity: 2 }] });
  };
  it('FV-J01 open/tier/counts -> scoped QR/menu -> order/KDS -> SERVED; checkout guard prevents fabricated payment', async () => {
    const { table, session, customer, raw } = await open();
    expect(
      await prisma.session.findUniqueOrThrow({ where: { id: raw } }),
    ).toMatchObject({
      tierId: tier,
      adultCount: 2,
      childCount: 1,
      status: 'ACTIVE',
    });
    record('FV-J01-OPEN', {
      tableId: table.id,
      selectedTier: tier,
      adultCount: 2,
      childCount: 1,
      status: 'ACTIVE',
    });
    const menus = data<{ id: string; name: string }[]>(
      await api()
        .get('/customer/menu-items')
        .auth(customer.customerAccessToken, { type: 'bearer' })
        .expect(200),
    );
    expect(menus.map((row) => row.name)).toEqual(['Visible fixture menu']);
    record('FV-J01-MENU', {
      visibleNames: menus.map((row) => row.name),
      unavailableAndOutsideTierExcluded: true,
    });
    const order = data<Order>(await place(customer).expect(201));
    const kds = data<{ id: string }[]>(
      await staff(api().get(`/orders/kitchen/${kitchen}`)).expect(200),
    );
    expect(
      kds.some(
        (row) =>
          ids.decode(row.id, IdPrefix.ORDER_ITEM) ===
          ids.decode(order.items[0].id, IdPrefix.ORDER_ITEM),
      ),
    ).toBe(true);
    for (const status of ['PREPARING', 'SERVED'])
      await staff(api().patch(`/orders/items/${order.items[0].id}/status`))
        .send({ status })
        .expect(200);
    expect(
      (
        await prisma.orderItem.findUniqueOrThrow({
          where: { id: ids.decode(order.items[0].id, IdPrefix.ORDER_ITEM) },
        })
      ).status,
    ).toBe('SERVED');
    record('FV-J01-SERVED', { kdsReceived: true, finalItemStatus: 'SERVED' });
    const before = await prisma.invoice.count({ where: { sessionId: raw } });
    const checkout = await staff(api().post('/invoices'))
      .send({
        sessionId: session.id,
        totalAmount: 997.25,
        discount: 0,
        paymentMethod: 'CASH',
      })
      .expect(503);
    expect(String((checkout.body as { message: string }).message)).toContain(
      'CHECKOUT_POLICY_PENDING',
    );
    expect(await prisma.invoice.count({ where: { sessionId: raw } })).toBe(
      before,
    );
    expect(
      (await prisma.session.findUniqueOrThrow({ where: { id: raw } })).status,
    ).toBe('ACTIVE');
    expect(
      (await prisma.table.findUniqueOrThrow({ where: { id: table.id } }))
        .status,
    ).toBe('OCCUPIED');
    record('FV-J01-CHECKOUT', {
      http: 503,
      code: 'CHECKOUT_POLICY_PENDING',
      createdInvoices: 0,
      session: 'ACTIVE',
      table: 'OCCUPIED',
      verifiedPaid: false,
    });
  });
  it('FV-R01 / BUG-FV-ORDER-RETRY: identical order retry reference must produce one resource', async () => {
    const { customer, raw } = await open(),
      key = randomUUID();
    const first = await place(customer, key).expect(201);
    const retry = await place(customer, key).expect(201);
    const firstId = data<Order>(first).id,
      retryId = data<Order>(retry).id;
    const count = await prisma.order.count({ where: { sessionId: raw } });
    record('FV-R01', {
      statuses: [first.status, retry.status],
      firstId,
      retryId,
      count,
      sameResource: firstId === retryId,
    });
    // Do not replace this expectation with count=2 to hide the missing retry contract.
    expect({ sameResource: firstId === retryId, count }).toEqual({
      sameResource: true,
      count: 1,
    });
  });
  it('FV-J02 manual CLOSED/CLEANING/AVAILABLE does not invent settlement or allow unpaid table reuse', async () => {
    const { table, session, raw } = await open();
    await staff(api().patch(`/sessions/${session.id}/status`))
      .send({ status: 'CLOSED' })
      .expect(200);
    expect(
      (await prisma.table.findUniqueOrThrow({ where: { id: table.id } }))
        .status,
    ).toBe('CLEANING');
    await staff(api().patch(`/tables/${table.id}/status`))
      .send({ status: 'AVAILABLE' })
      .expect(200);
    await staff(api().post('/sessions'))
      .send({ tableId: table.id, tierId: tier, adultCount: 1, childCount: 0 })
      .expect(409);
    expect(await prisma.invoice.count({ where: { sessionId: raw } })).toBe(0);
    record('FV-J02', {
      manualStatuses: ['CLOSED', 'CLEANING', 'AVAILABLE'],
      reopenHttp: 409,
      invoiceCount: 0,
      paymentConfirmed: false,
    });
  });
});
