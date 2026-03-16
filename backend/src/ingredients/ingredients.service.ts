import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

// จุดวิกฤตของสต็อก (%)
const LOW_STOCK_THRESHOLD = 20;

@Injectable()
export class IngredientsService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  findAll() {
    return this.prisma.ingredient.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id },
      include: { recipes: { include: { menuItem: true } } },
    });
    if (!ingredient) throw new NotFoundException(`Ingredient #${id} not found`);
    return ingredient;
  }

  async create(dto: CreateIngredientDto) {
    return this.prisma.ingredient.create({ data: dto });
  }

  async update(id: number, dto: UpdateIngredientDto) {
    await this.findOne(id);
    return this.prisma.ingredient.update({ where: { id }, data: dto });
  }

  async adjustStock(id: number, dto: AdjustStockDto) {
    const ingredient = await this.findOne(id);

    const newStock = Number(ingredient.currentStock) + dto.amount;
    if (newStock < 0) {
      throw new BadRequestException('Stock cannot be negative');
    }

    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: { currentStock: newStock },
    });

    // [Socket] แจ้งเตือนถ้า stock ต่ำกว่า threshold
    const stockPercent =
      (newStock / (Number(ingredient.currentStock) || 1)) * 100;
    if (stockPercent <= LOW_STOCK_THRESHOLD || newStock === 0) {
      this.events.emitLowStock({
        ingredientId: id,
        name: ingredient.name,
        currentStock: newStock,
        unit: ingredient.unit,
        isEmpty: newStock === 0,
      });
    }

    return updated;
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.ingredient.delete({ where: { id } });
  }
}