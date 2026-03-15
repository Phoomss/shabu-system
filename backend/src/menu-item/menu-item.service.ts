import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

const menuItemSelect = {
  id: true,
  name: true,
  imageUrl: true,
  isAvailable: true,
  category: { select: { id: true, name: true } },
  kitchen: { select: { id: true, name: true } },
  tierItems: { include: { tier: true } },
};

@Injectable()
export class MenuItemService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) { }

  findAll() {
    return this.prisma.menuItem.findMany({ select: menuItemSelect });
  }

  async findOne(id: string) {
    const item = await this.prisma.menuItem.findUnique({
      where: { id },
      select: menuItemSelect,
    });
    if (!item) throw new NotFoundException(`MenuItem #${id} not found`);
    return item;
  }

  async findByTier(tierId: number) {
    return this.prisma.menuItem.findMany({
      where: {
        isAvailable: true,
        tierItems: { some: { tierId } },
      },
      select: menuItemSelect,
    });
  }

  async create(dto: CreateMenuItemDto) {
    const { tierIds, ...data } = dto;

    return this.prisma.menuItem.create({
      data: {
        ...data,
        tierItems: tierIds
          ? { create: tierIds.map((tierId) => ({ tierId })) }
          : undefined,
      },
      select: menuItemSelect,
    });
  }

  async update(id: string, dto: UpdateMenuItemDto) {
    await this.findOne(id);
    const { tierIds, ...data } = dto;

    return this.prisma.menuItem.update({
      where: { id },
      data: {
        ...data,
        tierItems: tierIds
          ? { deleteMany: {}, create: tierIds.map((tierId) => ({ tierId })) }
          : undefined,
      },
      select: menuItemSelect,
    });
  }

  // [Socket] toggle เมนูหมด/มีของ แจ้ง client ทันที
  async toggleAvailability(id: string) {
    const item = await this.findOne(id);

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: { isAvailable: !item.isAvailable },
    });

    this.events.emitMenuAvailability(id, updated.isAvailable, updated.name);

    return updated;
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.menuItem.delete({ where: { id } });
  }
}