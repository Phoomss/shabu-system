import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { EventsGateway } from 'src/events/events.gateway';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import { VoidItemDto } from './dto/void-item.dto';
import { IdTransformer, IdPrefix } from 'src/common/utils/id-transformer.util';
import { SessionStatus, ItemStatus, OrderStatus, Prisma } from '@prisma/client';

import {
  assertItemTransition,
  assertOrderTransition,
  MAX_ITEM_QUANTITY,
  MAX_ORDER_ITEMS,
} from './order-rules';

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
    private idTransformer: IdTransformer,
  ) {}

  // ─── Order ───────────────────────────────────────────────

  async findAll(sessionId?: string) {
    if (sessionId !== undefined) {
      sessionId = this.idTransformer.decode(sessionId, IdPrefix.SESSION);
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId },
      });
      if (!session) throw new NotFoundException('Session not found');
    }
    return this.prisma.order.findMany({
      where: sessionId !== undefined ? { sessionId } : undefined,
      include: { items: { select: orderItemSelect } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    id = this.idTransformer.decode(id, IdPrefix.ORDER);
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { select: orderItemSelect } },
    });
    if (!order) throw new NotFoundException(`Order #${id} not found`);
    return order;
  }

  /** Serialize workflow mutations; a serialization conflict is a retryable 409, never a partial write. */
  private async atomic<T>(
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        throw new ConflictException(
          'Order changed concurrently; reload before retrying',
        );
      throw error;
    }
  }

  async create(dto: CreateOrderDto) {
    if (
      !Array.isArray(dto.items) ||
      dto.items.length < 1 ||
      dto.items.length > MAX_ORDER_ITEMS
    )
      throw new BadRequestException(
        `items must contain 1-${MAX_ORDER_ITEMS} entries`,
      );
    for (const item of dto.items) {
      if (
        !item ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > MAX_ITEM_QUANTITY
      )
        throw new BadRequestException(
          `quantity must be an integer from 1-${MAX_ITEM_QUANTITY}`,
        );
    }
    const sessionId = this.idTransformer.decode(
      dto.sessionId,
      IdPrefix.SESSION,
    );
    const items = dto.items.map((item) => ({
      ...item,
      menuItemId: this.idTransformer.decode(
        item.menuItemId,
        IdPrefix.MENU_ITEM,
      ),
    }));
    const menuItemIds = items.map((item) => item.menuItemId);
    if (new Set(menuItemIds).size !== menuItemIds.length)
      throw new BadRequestException(
        'Duplicate menu items; use one entry per menu',
      );

    const order = await this.atomic(async (tx) => {
      // Session close/expiry writes the same row. Check time after acquiring this lock.
      await tx.$queryRaw`SELECT id FROM "Session" WHERE id = ${sessionId} FOR UPDATE`;
      const session = await tx.session.findUnique({ where: { id: sessionId } });
      if (!session) throw new NotFoundException('Session not found');
      if (
        session.status !== SessionStatus.ACTIVE ||
        session.endTime.getTime() <= Date.now()
      )
        throw new BadRequestException('Session is closed or expired');
      const menuItems = await tx.menuItem.findMany({
        where: {
          id: { in: menuItemIds },
          isAvailable: true,
          tierItems: { some: { tierId: session.tierId } },
        },
      });
      if (menuItems.length !== menuItemIds.length)
        throw new BadRequestException(
          'Some menu items do not exist, are unavailable, or are outside the session tier',
        );
      return tx.order.create({
        data: {
          sessionId,
          items: {
            create: items.map((item) => ({
              menuItemId: item.menuItemId,
              kitchenId: menuItems.find((menu) => menu.id === item.menuItemId)!
                .kitchenId,
              quantity: item.quantity,
              status: ItemStatus.PENDING,
            })),
          },
        },
        include: { items: { select: orderItemSelect } },
      });
    });
    const kitchenIds = new Set(order.items.map((item) => item.kitchen.id));
    for (const kitchenId of kitchenIds) {
      await this.events.emitNewOrderItem(kitchenId, {
        orderId: order.id,
        sessionId,
        items: order.items.filter((item) => item.kitchen.id === kitchenId),
      });
    }
    await this.events.emitOrderStatus(sessionId, order);
    return order;
  }

  private async lockOrder(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id },
      include: { items: { select: orderItemSelect } },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  private emitItem(
    sessionId: string,
    orderId: string,
    item: {
      id: string;
      status: ItemStatus;
      menuItem: { id: string; name: string };
      kitchen: { id: number; name: string };
    },
  ) {
    return this.events.emitItemStatus(sessionId, {
      orderItemId: item.id,
      orderId,
      status: item.status,
      menuItem: item.menuItem,
      kitchen: item.kitchen,
    });
  }

  async updateStatus(id: string, dto: UpdateOrderStatusDto) {
    id = this.idTransformer.decode(id, IdPrefix.ORDER);
    const result = await this.atomic(async (tx) => {
      const before = await this.lockOrder(tx, id);
      assertOrderTransition(before.status, dto.status);
      const changedIds = before.items
        .filter((item) => item.status === ItemStatus.PENDING)
        .map((item) => item.id);
      await tx.orderItem.updateMany({
        where: { orderId: id, status: ItemStatus.PENDING },
        data: { status: ItemStatus.PREPARING },
      });
      const order = await tx.order.update({
        where: { id },
        data: { status: dto.status },
        include: { items: { select: orderItemSelect } },
      });
      return { order, changedIds };
    });
    for (const item of result.order.items.filter((item) =>
      result.changedIds.includes(item.id),
    ))
      await this.emitItem(result.order.sessionId, id, item);
    await this.events.emitOrderStatus(result.order.sessionId, result.order);
    return result.order;
  }

  // ─── OrderItem ────────────────────────────────────────────

  async findItemsByKitchen(kitchenId: number) {
    kitchenId = this.idTransformer.decodeInt(kitchenId, IdPrefix.KITCHEN);
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
    itemId = this.idTransformer.decode(itemId, IdPrefix.ORDER_ITEM);
    const result = await this.atomic(async (tx) => {
      const reference = await tx.orderItem.findUnique({
        where: { id: itemId },
        select: { orderId: true },
      });
      if (!reference) throw new NotFoundException('Order item not found');
      const before = await this.lockOrder(tx, reference.orderId);
      if (before.status === OrderStatus.CANCELLED)
        throw new BadRequestException('Order is cancelled');
      const item = before.items.find((row) => row.id === itemId)!;
      assertItemTransition(item.status, dto.status);
      const updated = await tx.orderItem.update({
        where: { id: itemId },
        data: { status: dto.status },
        include: {
          menuItem: { select: { id: true, name: true, imageUrl: true } },
          kitchen: { select: { id: true, name: true } },
        },
      });
      // Preserve the existing all-served confirmation rule, atomically, without reviving cancelled orders.
      const complete = before.items.every((row) =>
        row.id === itemId
          ? dto.status === ItemStatus.SERVED
          : [ItemStatus.SERVED, ItemStatus.VOIDED].includes(
              row.status as 'SERVED' | 'VOIDED',
            ),
      );
      const headerChanged = complete && before.status === OrderStatus.PENDING;
      const order = headerChanged
        ? await tx.order.update({
            where: { id: before.id },
            data: { status: OrderStatus.CONFIRMED },
            include: { items: { select: orderItemSelect } },
          })
        : null;
      return {
        updated,
        sessionId: before.sessionId,
        orderId: before.id,
        order,
      };
    });
    await this.emitItem(result.sessionId, result.orderId, result.updated);
    if (result.order)
      await this.events.emitOrderStatus(result.sessionId, result.order);
    return result.updated;
  }

  async voidItem(itemId: string, dto: VoidItemDto, managerId: string) {
    itemId = this.idTransformer.decode(itemId, IdPrefix.ORDER_ITEM);
    managerId = this.idTransformer.decode(managerId, IdPrefix.USER);
    const reason = dto.reason?.trim();
    if (!reason || reason.length < 3 || reason.length > 1000)
      throw new BadRequestException(
        'Void reason must contain 3-1000 non-blank characters',
      );
    const result = await this.atomic(async (tx) => {
      const reference = await tx.orderItem.findUnique({
        where: { id: itemId },
        select: { orderId: true },
      });
      if (!reference) throw new NotFoundException('Order item not found');
      const order = await this.lockOrder(tx, reference.orderId);
      const item = order.items.find((row) => row.id === itemId)!;
      if (
        order.status === OrderStatus.CANCELLED ||
        ![ItemStatus.PENDING, ItemStatus.PREPARING].includes(
          item.status as 'PENDING' | 'PREPARING',
        )
      )
        throw new BadRequestException(
          'Only pending/preparing items of a non-cancelled order can be voided',
        );
      const updated = await tx.orderItem.update({
        where: { id: itemId },
        data: { status: ItemStatus.VOIDED },
        include: {
          menuItem: { select: { id: true, name: true, imageUrl: true } },
          kitchen: { select: { id: true, name: true } },
        },
      });
      await tx.voidLog.create({
        data: { orderItemId: itemId, reason, approvedBy: managerId },
      });
      return { updated, order };
    });
    await this.events.emitVoidOrderItem(result.updated.kitchen.id, {
      orderItemId: itemId,
      orderId: result.order.id,
      status: result.updated.status,
      reason,
    });
    await this.emitItem(
      result.order.sessionId,
      result.order.id,
      result.updated,
    );
    return result.updated;
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
