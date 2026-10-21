import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';
import { randomUUID } from 'node:crypto';
describe('IngredientsController actor attribution', () => {
  it('uses authenticated actor for creation/adjustment, not body data', async () => {
    const create = jest.fn(),
      adjustStock = jest.fn();
    const controller = new IngredientsController({
      create,
      adjustStock,
    } as unknown as IngredientsService);
    const req = { user: { id: randomUUID() } };
    const ingredient = { name: 'Beef', unit: 'g', currentStock: 10 };
    const adjustment = {
      amount: -1,
      reference: randomUUID(),
      reason: 'Inventory count',
    };
    await controller.create(ingredient, req);
    await controller.adjustStock(7, adjustment, req);
    expect(create).toHaveBeenCalledWith(ingredient, req.user.id);
    expect(adjustStock).toHaveBeenCalledWith(7, adjustment, req.user.id);
  });
});
