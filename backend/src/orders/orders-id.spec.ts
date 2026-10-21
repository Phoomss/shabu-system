import { BadRequestException, NotFoundException } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { IdPrefix, IdTransformer } from '../common/utils/id-transformer.util';

describe('Order/session ID compatibility', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const ids = new IdTransformer();
  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    session: { findUnique: jest.fn() },
    order: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    menuItem: { findMany: jest.fn() },
  };
  const events = { emitOrderStatus: jest.fn(), emitNewOrderItem: jest.fn() };
  let service: OrdersService;
  beforeEach(() => {
    jest.clearAllMocks();
    service = new OrdersService(
      prisma as unknown as PrismaService,
      events as unknown as EventsGateway,
      ids,
    );
    prisma.$transaction.mockImplementation((work: (tx: unknown) => unknown) =>
      work(prisma),
    );
    prisma.session.findUnique.mockResolvedValue({
      id,
      status: 'ACTIVE',
      tierId: 1,
      endTime: new Date(Date.now() + 3600000),
    });
    prisma.order.findMany.mockResolvedValue([]);
    prisma.menuItem.findMany.mockResolvedValue([
      { id, kitchenId: 1, isAvailable: true },
    ]);
    prisma.order.create.mockResolvedValue({ id, items: [] });
  });
  it.each([id, ids.encode(id, IdPrefix.SESSION)])(
    'resolves the same session when listing/ordering: %s',
    async (sessionId) => {
      await service.findAll(sessionId);
      await service.create({
        sessionId,
        items: [{ menuItemId: id, quantity: 1 }],
      });
      expect(prisma.session.findUnique).toHaveBeenCalledWith({ where: { id } });
      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sessionId: id } }),
      );
      expect(prisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sessionId: id }) as unknown,
        }),
      );
      expect(events.emitOrderStatus).toHaveBeenCalledWith(
        id,
        expect.anything(),
      );
    },
  );
  it('uses decoded order PKs and returns 404 when not found', async () => {
    prisma.order.findUnique.mockResolvedValue(null);
    await expect(
      service.findOne(ids.encode(id, IdPrefix.ORDER)),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.order.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id } }),
    );
  });
  it('rejects malformed or wrong-entity aliases before querying', async () => {
    await expect(service.findAll('ses_nope')).rejects.toThrow(
      BadRequestException,
    );
    await expect(
      service.findAll(ids.encode(id, IdPrefix.INVOICE)),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.session.findUnique).not.toHaveBeenCalled();
  });
});
