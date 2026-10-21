import { IngredientsService } from './ingredients.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsGateway } from '../events/events.gateway';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { randomUUID } from 'node:crypto';

describe('Inventory API validation and ledger bypass protection', () => {
  const service = new IngredientsService(
    {} as PrismaService,
    {} as EventsGateway,
  );
  it('requires event UUID and meaningful reason and rejects nonfinite quantities', async () => {
    const valid = {
      amount: -1,
      reference: randomUUID(),
      reason: 'Stock count',
    };
    expect(await validate(plainToInstance(AdjustStockDto, valid))).toHaveLength(
      0,
    );
    for (const invalid of [
      { reference: undefined },
      { reference: 'opening' },
      { reason: '  ' },
      { amount: Infinity },
      { amount: NaN },
    ])
      expect(
        (
          await validate(
            plainToInstance(AdjustStockDto, { ...valid, ...invalid }),
          )
        ).length,
      ).toBeGreaterThan(0);
  });
  it('rejects direct balance/unit changes including service callers', async () => {
    for (const payload of [{ currentStock: 0 }, { unit: 'kg' }]) {
      expect(
        (
          await validate(plainToInstance(UpdateIngredientDto, payload), {
            whitelist: true,
            forbidNonWhitelisted: true,
          })
        ).length,
      ).toBeGreaterThan(0);
      await expect(
        service.update(1, payload as UpdateIngredientDto),
      ).rejects.toThrow('Use stock adjustment');
    }
  });
  it('accepts explicit absolute threshold or null; rejects negative threshold', async () => {
    for (const threshold of [0, 20, null])
      expect(
        await validate(
          plainToInstance(CreateIngredientDto, {
            name: 'Beef',
            unit: 'g',
            currentStock: 1,
            reorderThreshold: threshold,
          }),
        ),
      ).toHaveLength(0);
    expect(
      (
        await validate(
          plainToInstance(UpdateIngredientDto, { reorderThreshold: -1 }),
        )
      ).length,
    ).toBeGreaterThan(0);
  });
  it('rejects zero, missing actor and invalid amount before any database mutation', async () => {
    await expect(
      service.adjustStock(
        1,
        { amount: 0, reference: randomUUID(), reason: 'test' },
        'actor',
      ),
    ).rejects.toThrow();
    await expect(
      service.adjustStock(
        1,
        { amount: 1, reference: randomUUID(), reason: 'test' },
        '',
      ),
    ).rejects.toThrow();
  });
});
