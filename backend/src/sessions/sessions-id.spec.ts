import { NotFoundException } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { IdPrefix, IdTransformer } from '../common/utils/id-transformer.util';
import { SessionStatus } from '@prisma/client';

describe('Session raw IDs and atomic close', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  const ids = new IdTransformer();
  const row = { id, tableId: 1, tierId: 1, table: { id: 1 }, tier: { id: 1 } };
  const events = {
    emitSessionStatus: jest.fn(),
    emitTableStatus: jest.fn(),
    emitSessionWarning: jest.fn(),
  };
  let tx: {
    session: { findUnique: jest.Mock; update: jest.Mock };
    table: { update: jest.Mock };
  };
  let service: SessionsService;
  beforeEach(() => {
    jest.clearAllMocks();
    tx = {
      session: {
        findUnique: jest.fn().mockResolvedValue(row),
        update: jest.fn().mockResolvedValue(row),
      },
      table: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      ...tx,
      $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) =>
        fn(tx),
      ),
    };
    service = new SessionsService(
      prisma as unknown as PrismaService,
      events as unknown as EventsGateway,
      ids,
    );
  });
  it.each([SessionStatus.CLOSED, SessionStatus.EXPIRED])(
    'updates using raw integer and emits only after commit: %s',
    async (status) => {
      await service.updateStatus(ids.encode(id, IdPrefix.SESSION), { status });
      expect(tx.session.findUnique).toHaveBeenCalledWith({ where: { id } });
      expect(tx.table.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { status: 'CLEANING' },
      });
      expect(events.emitTableStatus).toHaveBeenCalledWith(1, 'CLEANING');
      expect(events.emitSessionStatus).toHaveBeenCalledWith(id, status);
    },
  );
  it('does not emit a successful status if transaction fails', async () => {
    tx.table.update.mockRejectedValue(new Error('write failed'));
    await expect(
      service.updateStatus(id, { status: SessionStatus.CLOSED }),
    ).rejects.toThrow('write failed');
    expect(tx.session.update).not.toHaveBeenCalled();
    expect(events.emitSessionStatus).not.toHaveBeenCalled();
    expect(events.emitTableStatus).not.toHaveBeenCalled();
  });
  it('returns 404 for a well formed missing ID', async () => {
    tx.session.findUnique.mockResolvedValue(null);
    await expect(
      service.updateStatus(id, { status: SessionStatus.CLOSED }),
    ).rejects.toThrow(NotFoundException);
  });
});
