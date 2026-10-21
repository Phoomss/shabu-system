import { BadRequestException } from '@nestjs/common';
import { ItemStatus, OrderStatus } from '@prisma/client';

// Technical request bounds, not a per-session dining quota.
export const MAX_ORDER_ITEMS = 100;
export const MAX_ITEM_QUANTITY = 99;

export function assertItemTransition(from: ItemStatus, to: ItemStatus) {
  const next: Record<ItemStatus, ItemStatus[]> = {
    PENDING: [ItemStatus.PREPARING],
    PREPARING: [ItemStatus.SERVED],
    SERVED: [],
    VOIDED: [],
  };
  if (!next[from].includes(to))
    throw new BadRequestException(
      `Invalid item transition: ${from} -> ${to}; VOIDED requires the audited void endpoint`,
    );
}

export function assertOrderTransition(from: OrderStatus, to: OrderStatus) {
  // Cancellation semantics have not been approved. Deny rather than cascade void/refund.
  if (from !== OrderStatus.PENDING || to !== OrderStatus.CONFIRMED)
    throw new BadRequestException(
      `Invalid or unapproved order transition: ${from} -> ${to}`,
    );
}
