import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

// Pure planning only: workflow callers require approved deduction/return semantics.
// No density, pack size, or piece conversion is inferred.
const units: Record<string, { dimension: string; factor: string }> = {
  g: { dimension: 'mass', factor: '1' },
  kg: { dimension: 'mass', factor: '1000' },
  ml: { dimension: 'volume', factor: '1' },
  l: { dimension: 'volume', factor: '1000' },
};
export function convertRecipeQuantity(
  quantity: Prisma.Decimal,
  from: string | null,
  to: string,
): Prisma.Decimal {
  if (!from?.trim() || !to.trim() || !quantity.isFinite() || quantity.lte(0))
    throw new BadRequestException(
      'Recipe quantity/unit must be explicitly verified',
    );
  if (from === to) return quantity;
  const source = units[from],
    target = units[to];
  if (!source || !target || source.dimension !== target.dimension)
    throw new BadRequestException(
      `Unsupported recipe conversion: ${from} -> ${to}`,
    );
  return quantity.mul(source.factor).div(target.factor);
}
export type StockPlanLine = {
  ingredientId: number;
  unit: string;
  quantity: Prisma.Decimal;
};
export function planRecipeDeduction(
  recipes: {
    ingredientId: number;
    quantityUsed: Prisma.Decimal;
    quantityUnit: string | null;
    ingredient: { unit: string };
  }[],
  portions: number,
): StockPlanLine[] {
  if (!Number.isSafeInteger(portions) || portions <= 0 || !recipes.length)
    throw new BadRequestException(
      'Positive integer portions and verified recipe required',
    );
  const lines = new Map<number, StockPlanLine>();
  for (const recipe of recipes) {
    const quantity = convertRecipeQuantity(
      recipe.quantityUsed,
      recipe.quantityUnit,
      recipe.ingredient.unit,
    )
      .mul(portions)
      .negated();
    const prior = lines.get(recipe.ingredientId);
    if (prior && prior.unit !== recipe.ingredient.unit)
      throw new BadRequestException('Inconsistent ingredient units');
    lines.set(recipe.ingredientId, {
      ingredientId: recipe.ingredientId,
      unit: recipe.ingredient.unit,
      quantity: prior ? prior.quantity.add(quantity) : quantity,
    });
  }
  return [...lines.values()].sort((a, b) => a.ingredientId - b.ingredientId);
}
// Proposed full return uses original deduction snapshot, never today's recipe.
// Eligibility, partial returns and event identity are left for business approval.
export function planFullRestoration(
  original: StockPlanLine[],
): StockPlanLine[] {
  if (
    !original.length ||
    original.some((line) => !line.quantity.isFinite() || line.quantity.gte(0))
  )
    throw new BadRequestException('Original deduction snapshot required');
  return original.map((line) => ({
    ...line,
    quantity: line.quantity.negated(),
  }));
}
