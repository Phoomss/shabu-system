import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

// PostgreSQL numeric(65,30): keep arithmetic exact without changing global money precision.
const StockDecimal = Prisma.Decimal.clone({ precision: 100 });

@Injectable()
export class IngredientsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  findAll() {
    return this.prisma.ingredient.findMany({ orderBy: { name: 'asc' } });
  }

  async findOne(id: number) {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id },
      include: { recipes: { include: { menuItem: true } } },
    });
    if (!ingredient) throw new NotFoundException(`Ingredient #${id} not found`);
    return ingredient;
  }

  async create(dto: CreateIngredientDto, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.create({ data: dto });
      await tx.stockMovement.create({
        data: {
          ingredientId: ingredient.id,
          reference: 'opening',
          type: 'OPENING',
          reason: 'Initial balance',
          quantity: ingredient.currentStock,
          unit: ingredient.unit,
          balanceAfter: ingredient.currentStock,
          actorId,
        },
      });
      return ingredient;
    });
  }

  async update(id: number, dto: UpdateIngredientDto) {
    // Also defend direct service callers from bypassing the ledger or changing its unit.
    if ('currentStock' in dto || 'unit' in dto)
      throw new BadRequestException(
        'Use stock adjustment; ingredient unit is immutable',
      );
    await this.findOne(id);
    return this.prisma.ingredient.update({ where: { id }, data: dto });
  }

  async adjustStock(id: number, dto: AdjustStockDto, actorId: string) {
    if (
      !actorId ||
      !dto.reference ||
      !dto.reason?.trim() ||
      !Number.isFinite(dto.amount) ||
      dto.amount === 0
    )
      throw new BadRequestException(
        'Actor, reference, reason and finite nonzero amount required',
      );
    // Decimal arithmetic avoids JS floating point errors. Lock before reading/replaying.
    const quantity = new Prisma.Decimal(dto.amount);
    if (quantity.decimalPlaces() > 30 || quantity.abs().gte('1e35'))
      throw new BadRequestException(
        'Quantity exceeds supported stock precision',
      );
    const reason = dto.reason.trim();
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Ingredient" WHERE id = ${id} FOR UPDATE`;
      const ingredient = await tx.ingredient.findUnique({ where: { id } });
      if (!ingredient)
        throw new NotFoundException(`Ingredient #${id} not found`);
      const existing = await tx.stockMovement.findUnique({
        where: {
          ingredientId_reference: {
            ingredientId: id,
            reference: dto.reference,
          },
        },
      });
      if (existing) {
        if (
          existing.type !== 'ADJUSTMENT' ||
          !existing.quantity.equals(quantity) ||
          existing.reason !== reason ||
          existing.actorId !== actorId
        )
          throw new ConflictException(
            'Reference already used with different payload/actor',
          );
        return { ingredient, replay: true };
      }
      const balance = new StockDecimal(ingredient.currentStock.toString()).add(
        quantity.toString(),
      );
      if (balance.isNegative())
        throw new BadRequestException('Stock cannot be negative');
      if (balance.gte('1e35'))
        throw new BadRequestException(
          'Balance exceeds supported stock precision',
        );
      const updated = await tx.ingredient.update({
        where: { id },
        data: { currentStock: balance },
      });
      await tx.stockMovement.create({
        data: {
          ingredientId: id,
          reference: dto.reference,
          type: 'ADJUSTMENT',
          reason,
          quantity,
          unit: ingredient.unit,
          balanceAfter: balance,
          actorId,
        },
      });
      return { ingredient: updated, replay: false };
    });
    const { ingredient, replay } = result;
    // Notifications are post-commit, only for a new decreasing event at the stored threshold.
    if (
      !replay &&
      quantity.isNegative() &&
      ingredient.reorderThreshold !== null &&
      ingredient.currentStock.lte(ingredient.reorderThreshold)
    ) {
      await this.events.emitLowStock({
        ingredientId: id,
        name: ingredient.name,
        currentStock: Number(ingredient.currentStock),
        unit: ingredient.unit,
        isEmpty: ingredient.currentStock.isZero(),
      });
    }
    return ingredient;
  }

  async movements(id: number) {
    await this.findOne(id);
    return this.prisma.stockMovement.findMany({
      where: { ingredientId: id },
      orderBy: { sequence: 'asc' },
    });
  }

  async reconcile(id: number) {
    // Lock so balance and SUM refer to the same committed state even during adjustments.
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Ingredient" WHERE id = ${id} FOR UPDATE`;
      const ingredient = await tx.ingredient.findUnique({ where: { id } });
      if (!ingredient)
        throw new NotFoundException(`Ingredient #${id} not found`);
      const sum = await tx.stockMovement.aggregate({
        where: { ingredientId: id },
        _sum: { quantity: true },
      });
      const ledgerBalance = sum._sum.quantity ?? new Prisma.Decimal(0);
      return {
        ingredientId: id,
        unit: ingredient.unit,
        currentStock: ingredient.currentStock,
        ledgerBalance,
        matches: ingredient.currentStock.equals(ledgerBalance),
      };
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    if (await this.prisma.stockMovement.count({ where: { ingredientId: id } }))
      throw new ConflictException(
        'Ingredient has stock history and cannot be deleted',
      );
    return this.prisma.ingredient.delete({ where: { id } });
  }
}
