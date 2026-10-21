import { Prisma } from '@prisma/client';
import {
  convertRecipeQuantity,
  planRecipeDeduction,
  planFullRestoration,
} from './recipe-stock-plan';
const d = (v: string | number) => new Prisma.Decimal(v);
describe('Policy-independent recipe stock plans', () => {
  it('converts compatible explicit units and scales portions with exact decimals', () => {
    expect(convertRecipeQuantity(d('0.125'), 'kg', 'g').toString()).toBe('125');
    expect(convertRecipeQuantity(d('200'), 'ml', 'l').toString()).toBe('0.2');
    expect(
      planRecipeDeduction(
        [
          {
            ingredientId: 2,
            quantityUsed: d('0.1'),
            quantityUnit: 'kg',
            ingredient: { unit: 'kg' },
          },
        ],
        3,
      )[0].quantity.toString(),
    ).toBe('-0.3');
  });
  it('rejects unverified legacy units and implicit density/pack conversions', () => {
    const pairs: [string | null, string][] = [
      [null, 'g'],
      ['kg', 'l'],
      ['pack', 'piece'],
      ['กรัม', 'kg'],
    ];
    for (const [from, to] of pairs)
      expect(() => convertRecipeQuantity(d(1), from, to)).toThrow();
    for (const n of ['0', '-1', 'NaN', 'Infinity'])
      expect(() => convertRecipeQuantity(d(n), 'g', 'g')).toThrow();
    expect(() => planRecipeDeduction([], 1)).toThrow();
  });
  it('plans restoration of the original snapshot independent of later recipe changes', () => {
    const plan = planRecipeDeduction(
      [
        {
          ingredientId: 1,
          quantityUsed: d(25),
          quantityUnit: 'g',
          ingredient: { unit: 'kg' },
        },
      ],
      2,
    );
    expect(planFullRestoration(plan)[0].quantity.toString()).toBe('0.05');
    expect(plan[0].quantity.toString()).toBe('-0.05');
    expect(() =>
      planFullRestoration([{ ingredientId: 1, unit: 'g', quantity: d(2) }]),
    ).toThrow();
  });
});
