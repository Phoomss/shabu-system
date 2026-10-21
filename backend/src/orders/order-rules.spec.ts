import { ItemStatus, OrderStatus } from '@prisma/client';
import { assertItemTransition, assertOrderTransition } from './order-rules';

describe('Explicit workflow transitions', () => {
  it.each(
    Object.values(ItemStatus).flatMap((from) =>
      Object.values(ItemStatus).map((to) => [from, to]),
    ),
  )('%s -> %s', (from, to) => {
    const allowed =
      (from === 'PENDING' && to === 'PREPARING') ||
      (from === 'PREPARING' && to === 'SERVED');
    if (allowed) expect(() => assertItemTransition(from, to)).not.toThrow();
    else expect(() => assertItemTransition(from, to)).toThrow();
  });
  it.each(
    Object.values(OrderStatus).flatMap((from) =>
      Object.values(OrderStatus).map((to) => [from, to]),
    ),
  )('order %s -> %s', (from, to) => {
    if (from === 'PENDING' && to === 'CONFIRMED')
      expect(() => assertOrderTransition(from, to)).not.toThrow();
    else expect(() => assertOrderTransition(from, to)).toThrow();
  });
});
