import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const bangkokNow = new Date(Date.now() + BANGKOK_OFFSET_MS);
    const todayStart = new Date(
      Date.UTC(
        bangkokNow.getUTCFullYear(),
        bangkokNow.getUTCMonth(),
        bangkokNow.getUTCDate(),
      ) - BANGKOK_OFFSET_MS,
    );
    const tomorrowStart = new Date(todayStart.getTime() + DAY_MS);
    const today = { gte: todayStart, lt: tomorrowStart };

    const [totalRevenue, todayRevenue, totalOrders, todayOrders, activeTables, totalTables, lowStockIngredients] =
      await Promise.all([
        this.prisma.invoice.aggregate({ _sum: { netAmount: true } }),
        this.prisma.invoice.aggregate({
          _sum: { netAmount: true },
          where: { createdAt: today },
        }),
        this.prisma.order.count(),
        this.prisma.order.count({ where: { createdAt: today } }),
        this.prisma.table.count({ where: { status: 'OCCUPIED' } }),
        this.prisma.table.count(),
        this.prisma.ingredient.count({ where: { currentStock: { lt: 20 } } }),
      ]);

    return {
      totalRevenue: Number(totalRevenue._sum.netAmount ?? 0),
      todayRevenue: Number(todayRevenue._sum.netAmount ?? 0),
      totalOrders,
      todayOrders,
      activeTables,
      totalTables,
      lowStockIngredients,
    };
  }
}
