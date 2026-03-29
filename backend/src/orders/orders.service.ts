import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import { VoidItemDto } from './dto/void-item.dto';
import { SessionStatus, ItemStatus, OrderStatus } from '@prisma/client';

const orderItemSelect = {
  id: true,
  quantity: true,
  status: true,
  menuItem: { select: { id: true, name: true, imageUrl: true } },
  kitchen: { select: { id: true, name: true } },
};

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private events: EventsGateway,
  ) {}

  // ─── Order ───────────────────────────────────────────────

  async findAll(sessionId?: string) {
    return this.prisma.order.findMany({
      where: sessionId ? { sessionId } : undefined,
      include: { items: { select: orderItemSelect } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { select: orderItemSelect } },
    });
    if (!order) throw new NotFoundException(`Order #${id} not found`);
    return order;
  }

  async create(dto: CreateOrderDto) {
    // เช็ค session
    const session = await this.prisma.session.findUnique({
      where: { id: dto.sessionId },
    });
    if (!session) throw new NotFoundException(`Session #${dto.sessionId} not found`);
    if (session.status !== SessionStatus.ACTIVE) {
      throw new BadRequestException('Session is no longer active');
    }

    // เช็ค menu items
    const menuItemIds = dto.items.map((i) => i.menuItemId);
    const menuItems = await this.prisma.menuItem.findMany({
      where: { id: { in: menuItemIds } },
    });

    if (menuItems.length !== menuItemIds.length) {
      throw new BadRequestException('Some menu items not found');
    }

    const unavailable = menuItems.filter((m) => !m.isAvailable);
    if (unavailable.length > 0) {
      throw new BadRequestException(
        `Menu items unavailable: ${unavailable.map((m) => m.name).join(', ')}`,
      );
    }

    // สร้าง order
    const order = await this.prisma.order.create({
      data: {
        sessionId: dto.sessionId,
        items: {
          create: dto.items.map((item) => {
            const menuItem = menuItems.find((m) => m.id === item.menuItemId)!;
            return {
              menuItemId: item.menuItemId,
              kitchenId: menuItem.kitchenId,
              quantity: item.quantity,
              status: ItemStatus.PENDING,
            };
          }),
        },
      },
      include: { items: { select: orderItemSelect } },
    });

    // [Socket] แจ้งแต่ละครัวที่เกี่ยวข้อง
    const kitchenGroups = new Map<number, any[]>();
    for (const item of order.items) {
      const kitchenId = item.kitchen.id;
      if (!kitchenGroups.has(kitchenId)) kitchenGroups.set(kitchenId, []);
      kitchenGroups.get(kitchenId)!.push(item);
    }

    kitchenGroups.forEach((items, kitchenId) => {
      console.log(`[Socket] Emitting new order to kitchen ${kitchenId}:`, items);
      this.events.emitNewOrderItem(kitchenId, {
        orderId: order.id,
        sessionId: dto.sessionId,
        items,
      });
    });

    // [Socket] แจ้ง session
    this.events.emitOrderStatus(dto.sessionId, order);

    return order;
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    const order = await this.findOne(id);

    const updated = await this.prisma.order.update({
      where: { id },
      data: { status: dto.status },
      include: { items: { select: orderItemSelect } },
    });

    // ถ้า staff ยืนยันออเดอร์ → เปลี่ยน item status เป็น PREPARING
    if (dto.status === OrderStatus.CONFIRMED) {
      await this.prisma.orderItem.updateMany({
        where: {
          orderId: id,
          status: ItemStatus.PENDING,
        },
        data: {
          status: ItemStatus.PREPARING,
        },
      });

      // [Socket] แจ้งครัวว่า item ถูกเปลี่ยนเป็น PREPARING
      for (const item of updated.items) {
        this.events.emitItemStatus(order.sessionId, {
          orderItemId: item.id,
          orderId: id,
          menuItem: item.menuItem,
          kitchen: item.kitchen,
          status: ItemStatus.PREPARING,
        });
      }
    }

    // [Socket] แจ้ง session
    this.events.emitOrderStatus(order.sessionId, updated);

    return updated;
  }

  // ─── OrderItem ────────────────────────────────────────────

  async findItemsByKitchen(kitchenId: number) {
    return this.prisma.orderItem.findMany({
      where: {
        kitchenId,
        voidLog: null,
      },
      include: {
        menuItem: { select: { id: true, name: true, imageUrl: true } },
        kitchen: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            sessionId: true,
            createdAt: true,
            session: {
              select: {
                table: {
                  select: {
                    id: true,
                    number: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { order: { createdAt: 'asc' } },
    });
  }

  async updateItemStatus(itemId: string, dto: UpdateItemStatusDto) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: itemId },
      include: {
        order: true,
        menuItem: { select: { id: true, name: true } },
        kitchen: { select: { id: true, name: true } },
      },
    });
    if (!item) throw new NotFoundException(`OrderItem #${itemId} not found`);
    if (item.status === ItemStatus.VOIDED) {
      throw new BadRequestException('Cannot update voided item');
    }

    const updated = await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { status: dto.status },
      include: {
        menuItem: { select: { id: true, name: true, imageUrl: true } },
        kitchen: { select: { id: true, name: true } },
      },
    });

    // [Socket] แจ้ง session ทันที
    this.events.emitItemStatus(item.order.sessionId, {
      orderItemId: itemId,
      orderId: item.orderId,
      menuItem: updated.menuItem,
      kitchen: updated.kitchen,
      status: dto.status,
    });

    // ถ้าทุก item เสิร์ฟหมดแล้ว → อัปเดต order เป็น CONFIRMED
    if (dto.status === ItemStatus.SERVED) {
      const pendingCount = await this.prisma.orderItem.count({
        where: {
          orderId: item.orderId,
          status: { notIn: [ItemStatus.SERVED, ItemStatus.VOIDED] },
        },
      });

      if (pendingCount === 0) {
        const confirmedOrder = await this.prisma.order.update({
          where: { id: item.orderId },
          data: { status: OrderStatus.CONFIRMED },
        });
        this.events.emitOrderStatus(item.order.sessionId, confirmedOrder);
      }
    }

    return updated;
  }

  async voidItem(itemId: string, dto: VoidItemDto, managerId: string) {
    const item = await this.prisma.orderItem.findUnique({
      where: { id: itemId },
      include: { order: true, kitchen: true },
    });

    if (!item) throw new NotFoundException(`OrderItem #${itemId} not found`);
    if (item.status === ItemStatus.SERVED) {
      throw new BadRequestException('Cannot void already served item');
    }
    if (item.status === ItemStatus.VOIDED) {
      throw new BadRequestException('Item already voided');
    }

    const [updatedItem] = await this.prisma.$transaction([
      this.prisma.orderItem.update({
        where: { id: itemId },
        data: { status: ItemStatus.VOIDED },
      }),
      this.prisma.voidLog.create({
        data: { orderItemId: itemId, reason: dto.reason, approvedBy: managerId },
      }),
    ]);

    // [Socket] แจ้งครัวว่า item ถูก void
    this.events.emitVoidOrderItem(item.kitchenId, {
      orderItemId: itemId,
      orderId: item.orderId,
      reason: dto.reason,
    });

    // [Socket] แจ้ง session ว่า item ถูก void
    this.events.emitItemStatus(item.order.sessionId, {
      orderItemId: itemId,
      orderId: item.orderId,
      status: ItemStatus.VOIDED,
      reason: dto.reason,
    });

    return updatedItem;
  }

  async findVoidLogs() {
    return this.prisma.voidLog.findMany({
      include: {
        orderItem: {
          include: {
            menuItem: true,
            order: {
              include: {
                session: {
                  include: {
                    table: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}