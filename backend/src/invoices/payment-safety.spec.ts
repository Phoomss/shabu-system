import { ServiceUnavailableException } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { IdTransformer } from '../common/utils/id-transformer.util';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { SettingsService } from '../settings/settings.service';

describe('Payment safety while business policy is unapproved', () => {
  it.each([0, 0.01, 999999])(
    'client amount %s cannot create an invoice or emit a payment event',
    (totalAmount) => {
      const prisma = { $transaction: jest.fn() },
        events = { emitNewInvoice: jest.fn() };
      const service = new InvoicesService(
        prisma as unknown as PrismaService,
        events as unknown as EventsGateway,
        new IdTransformer(),
      );
      expect(() =>
        service.create(
          {
            sessionId: '00000000-0000-4000-8000-000000000001',
            totalAmount,
            paymentMethod: 'QR_CODE',
          },
          '00000000-0000-4000-8000-000000000002',
        ),
      ).toThrow(ServiceUnavailableException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(events.emitNewInvoice).not.toHaveBeenCalled();
    },
  );
  it.each([undefined, '', '   ', 'x'.repeat(65), 'bad\u0000reference'])(
    'invalid receiver config is rejected before writing: %j',
    async (value) => {
      const upsert = jest.fn();
      const settings = new SettingsService({
        paymentSettings: { upsert },
      } as unknown as PrismaService);
      await expect(
        settings.updatePaymentSettings(
          { promptPayNumber: value as string },
          'fixture',
        ),
      ).rejects.toThrow();
      expect(upsert).not.toHaveBeenCalled();
    },
  );
});
