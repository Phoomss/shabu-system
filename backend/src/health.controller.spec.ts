import { HealthController } from './health.controller';
import { PrismaService } from './prisma/prisma.service';
describe('Database readiness', () => {
  it('checks the DB rather than returning unconditional success', async () => {
    const $queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    await expect(
      new HealthController({ $queryRaw } as unknown as PrismaService).ready(),
    ).resolves.toEqual({ status: 'ok' });
    expect($queryRaw).toHaveBeenCalledTimes(1);
  });
  it('returns unavailable without database internals when DB fails', async () => {
    const $queryRaw = jest
      .fn()
      .mockRejectedValue(new Error('private connection detail'));
    await expect(
      new HealthController({ $queryRaw } as unknown as PrismaService).ready(),
    ).rejects.toThrow('Database unavailable');
  });
});
