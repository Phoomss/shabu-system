import { randomUUID } from 'node:crypto';
import { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { IngredientsService } from '../src/ingredients/ingredients.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { EventsGateway } from '../src/events/events.gateway';
import { OrdersService } from '../src/orders/orders.service';
import { IdTransformer } from '../src/common/utils/id-transformer.util';
import { Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { IngredientsController } from '../src/ingredients/ingredients.controller';
import { JwtGuard } from '../src/auth/guards/jwt.guard';
const config = JSON.parse(
  readFileSync(
    resolve(__dirname, '../../reports/inventory-evidence/test-database.json'),
    'utf8',
  ),
) as { url: string };
const target = new URL(config.url);
if (
  process.env.ALLOW_SHABU_TEST_DB !== '1' ||
  target.hostname !== '127.0.0.1' ||
  target.port !== '55432' ||
  !/^\/shabu_inventory_\d+$/.test(target.pathname)
)
  throw Error('Isolated inventory DB opt-in required');
process.env.DATABASE_URL = config.url;
describe('F14 real PostgreSQL transactions and ledger', () => {
  const prisma = new PrismaService();
  const emitLowStock = jest.fn().mockResolvedValue(undefined);
  const service = new IngredientsService(prisma, {
    emitLowStock,
  } as unknown as EventsGateway);
  let actor: string;
  beforeAll(async () => {
    await prisma.$connect();
    const role = await prisma.role.create({
      data: { name: `INVENTORY-${randomUUID()}` },
    });
    actor = (
      await prisma.user.create({
        data: {
          roleId: role.id,
          username: randomUUID(),
          passwordHash: 'test-only',
          fullName: 'Inventory fixture',
        },
      })
    ).id;
  });
  beforeEach(() => emitLowStock.mockClear());
  afterAll(async () => {
    await prisma.$disconnect();
  });
  const ingredient = (currentStock = 100, reorderThreshold?: number) =>
    service.create(
      { name: randomUUID(), unit: 'g', currentStock, reorderThreshold },
      actor,
    );
  const adjust = (id: number, amount: number, reference = randomUUID()) =>
    service.adjustStock(
      id,
      { amount, reason: 'Inventory test', reference },
      actor,
    );
  it('parallel unique adjustments have no lost updates and reconcile exactly', async () => {
    const i = await ingredient();
    await Promise.all(Array.from({ length: 20 }, () => adjust(i.id, -0.1)));
    expect((await service.findOne(i.id)).currentStock.toString()).toBe('98');
    expect(await service.reconcile(i.id)).toMatchObject({ matches: true });
    expect(
      await prisma.stockMovement.count({ where: { ingredientId: i.id } }),
    ).toBe(21);
  });
  it('parallel duplicate event/retry adjusts once and mismatched reuse conflicts', async () => {
    const i = await ingredient(),
      reference = randomUUID();
    await Promise.all(
      Array.from({ length: 10 }, () => adjust(i.id, -7, reference)),
    );
    await adjust(i.id, -7, reference);
    expect((await service.findOne(i.id)).currentStock.toString()).toBe('93');
    expect(
      await prisma.stockMovement.count({ where: { ingredientId: i.id } }),
    ).toBe(2);
    await expect(adjust(i.id, -8, reference)).rejects.toThrow(
      'different payload/actor',
    );
    await expect(
      service.adjustStock(
        i.id,
        { amount: -7, reference, reason: 'changed' },
        actor,
      ),
    ).rejects.toThrow('different payload/actor');
    await expect(
      service.adjustStock(
        i.id,
        { amount: -7, reference, reason: 'Inventory test' },
        randomUUID(),
      ),
    ).rejects.toThrow('different payload/actor');
  });
  it('parallel insufficient stock permits only one debit with no failed ledger row', async () => {
    const i = await ingredient(10);
    const results = await Promise.allSettled([
      adjust(i.id, -7),
      adjust(i.id, -7),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await service.findOne(i.id)).currentStock.toString()).toBe('3');
    expect(await service.reconcile(i.id)).toMatchObject({ matches: true });
    expect(
      await prisma.stockMovement.count({ where: { ingredientId: i.id } }),
    ).toBe(2);
  });
  it('ledger insert failure rolls back balance and emits nothing', async () => {
    const i = await ingredient(30, 20);
    await expect(
      service.adjustStock(
        i.id,
        { amount: -15, reason: 'bad actor', reference: randomUUID() },
        randomUUID(),
      ),
    ).rejects.toThrow();
    expect((await service.findOne(i.id)).currentStock.toString()).toBe('30');
    expect(await service.reconcile(i.id)).toMatchObject({ matches: true });
    expect(emitLowStock).not.toHaveBeenCalled();
  });
  it('uses stored threshold including equality, ignores previous ratio and replay', async () => {
    const i = await ingredient(1000, 20);
    await adjust(i.id, -900);
    expect(emitLowStock).not.toHaveBeenCalled();
    const reference = randomUUID();
    await adjust(i.id, -80, reference);
    expect(emitLowStock).toHaveBeenCalledTimes(1);
    expect(emitLowStock).toHaveBeenCalledWith(
      expect.objectContaining({ currentStock: 20, isEmpty: false }),
    );
    await adjust(i.id, -80, reference);
    await adjust(i.id, 1);
    expect(emitLowStock).toHaveBeenCalledTimes(1);
    await adjust(i.id, -21);
    expect(emitLowStock).toHaveBeenLastCalledWith(
      expect.objectContaining({ currentStock: 0, isEmpty: true }),
    );
    const unconfigured = await ingredient(100);
    emitLowStock.mockClear();
    await adjust(unconfigured.id, -100);
    expect(emitLowStock).not.toHaveBeenCalled();
  });
  it('prevents balance/unit bypass, history deletion and ledger mutation', async () => {
    const i = await ingredient();
    await expect(
      service.update(i.id, { currentStock: 0 } as never),
    ).rejects.toThrow();
    await expect(
      service.update(i.id, { unit: 'kg' } as never),
    ).rejects.toThrow();
    await expect(service.remove(i.id)).rejects.toThrow('history');
    const m = await prisma.stockMovement.findFirstOrThrow({
      where: { ingredientId: i.id },
    });
    await expect(
      prisma.stockMovement.update({
        where: { id: m.id },
        data: { reason: 'overwrite' },
      }),
    ).rejects.toThrow('append-only');
    expect(await service.reconcile(i.id)).toMatchObject({ matches: true });
  });
  it('mixed concurrent credits/debits preserve each recorded balance', async () => {
    const i = await ingredient(100);
    await Promise.all(
      Array.from({ length: 12 }, (_, n) => adjust(i.id, n % 2 ? -3.25 : 4.75)),
    );
    const movements = await service.movements(i.id);
    let balance = new Prisma.Decimal(0);
    for (const m of movements) {
      balance = balance.add(m.quantity);
      expect(m.balanceAfter.equals(balance)).toBe(true);
      expect(m.actorId).toBe(actor);
      expect(m.unit).toBe('g');
    }
    expect(balance.toString()).toBe('109');
    expect(await service.reconcile(i.id)).toMatchObject({ matches: true });
  });
  it('confirmation and audited void do not apply unapproved recipe stock policy', async () => {
    const i = await ingredient(100);
    const kitchen = await prisma.kitchenSection.create({
      data: { name: randomUUID() },
    });
    const category = await prisma.category.create({
      data: { name: randomUUID() },
    });
    const menu = await prisma.menuItem.create({
      data: {
        name: 'Recipe fixture',
        kitchenId: kitchen.id,
        categoryId: category.id,
        recipe: {
          create: { ingredientId: i.id, quantityUsed: 5, quantityUnit: 'g' },
        },
      },
    });
    const tier = await prisma.tier.create({
      data: { name: randomUUID(), priceAdult: 100, priceChild: 50 },
    });
    const table = await prisma.table.create({ data: { number: randomUUID() } });
    const session = await prisma.session.create({
      data: {
        tierId: tier.id,
        tableId: table.id,
        qrToken: randomUUID(),
        endTime: new Date(Date.now() + 60000),
      },
    });
    const order = await prisma.order.create({
      data: {
        sessionId: session.id,
        items: {
          create: { menuItemId: menu.id, kitchenId: kitchen.id, quantity: 2 },
        },
      },
      include: { items: true },
    });
    const events = {
      emitItemStatus: jest.fn().mockResolvedValue(undefined),
      emitOrderStatus: jest.fn().mockResolvedValue(undefined),
      emitVoidOrderItem: jest.fn().mockResolvedValue(undefined),
    };
    const orders = new OrdersService(
      prisma,
      events as unknown as EventsGateway,
      new IdTransformer(),
    );
    await orders.updateStatus(order.id, { status: 'CONFIRMED' });
    await orders.voidItem(
      order.items[0].id,
      { reason: 'Approved workflow fixture' },
      actor,
    );
    await expect(
      orders.voidItem(
        order.items[0].id,
        { reason: 'Approved workflow fixture' },
        actor,
      ),
    ).rejects.toThrow();
    expect(
      await prisma.voidLog.count({ where: { orderItemId: order.items[0].id } }),
    ).toBe(1);
    expect((await service.findOne(i.id)).currentStock.toString()).toBe('100');
    expect(
      await prisma.stockMovement.count({ where: { ingredientId: i.id } }),
    ).toBe(1);
    expect(await service.reconcile(i.id)).toMatchObject({ matches: true });
  });
  it('parallel HTTP requests preserve stock and validate the new event contract', async () => {
    // Auth is fixture-injected here; permission/auth coverage remains in the security suite.
    const module = await Test.createTestingModule({
      controllers: [IngredientsController],
      providers: [{ provide: IngredientsService, useValue: service }],
    })
      .overrideGuard(JwtGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { user: { id: string } } };
        }) => {
          context.switchToHttp().getRequest().user = { id: actor };
          return true;
        },
      })
      .compile();
    const app: INestApplication<Server> = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
    try {
      const i = await ingredient(100);
      const endpoint = `/ingredients/${i.id}/stock`;
      const body = {
        amount: -2,
        reference: randomUUID(),
        reason: 'HTTP count fixture',
      };
      const duplicate = await Promise.all(
        Array.from({ length: 8 }, () =>
          request(app.getHttpServer()).patch(endpoint).send(body),
        ),
      );
      expect(duplicate.map((r) => r.status)).toEqual(Array(8).fill(200));
      const unique = await Promise.all(
        Array.from({ length: 8 }, () =>
          request(app.getHttpServer())
            .patch(endpoint)
            .send({ ...body, reference: randomUUID() }),
        ),
      );
      expect(unique.map((r) => r.status)).toEqual(Array(8).fill(200));
      expect((await service.findOne(i.id)).currentStock.toString()).toBe('82');
      expect(await service.reconcile(i.id)).toMatchObject({ matches: true });
      await request(app.getHttpServer())
        .patch(endpoint)
        .send({ amount: 1, reason: 'No event key' })
        .expect(400);
      await request(app.getHttpServer())
        .patch(`/ingredients/${i.id}`)
        .send({ currentStock: 999 })
        .expect(400);
    } finally {
      await app.close();
    }
  });
  it('preserves full database precision without rounding balances at 20 digits', async () => {
    const balance = new Prisma.Decimal('123456789012345678901.123456789');
    const i = await prisma.ingredient.create({
      data: {
        name: randomUUID(),
        unit: 'g',
        currentStock: balance,
        movements: {
          create: {
            reference: 'opening',
            type: 'OPENING',
            reason: 'Precision fixture',
            quantity: balance,
            unit: 'g',
            balanceAfter: balance,
            actorId: actor,
          },
        },
      },
    });
    await adjust(i.id, 0.1);
    expect((await service.findOne(i.id)).currentStock.toString()).toBe(
      '123456789012345678901.223456789',
    );
    expect(await service.reconcile(i.id)).toMatchObject({ matches: true });
    await expect(adjust(i.id, 1e-31)).rejects.toThrow('precision');
  });
});
