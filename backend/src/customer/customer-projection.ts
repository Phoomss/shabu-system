// Explicit allowlists: never forward an expanded Prisma include to a customer socket.
export function customerOrder(order: {
  id: string;
  sessionId: string;
  status: string;
  createdAt?: Date;
  orderNumber?: number;
  items?: Array<{
    id: string;
    quantity: number;
    status: string;
    menuItem: { id: string; name: string; imageUrl?: string | null };
  }>;
}) {
  return {
    id: order.id,
    sessionId: order.sessionId,
    status: order.status,
    createdAt: order.createdAt,
    orderNumber: order.orderNumber,
    ...(order.items
      ? {
          items: order.items.map((item) => ({
            id: item.id,
            quantity: item.quantity,
            status: item.status,
            menuItem: {
              id: item.menuItem.id,
              name: item.menuItem.name,
              imageUrl: item.menuItem.imageUrl,
            },
          })),
        }
      : {}),
  };
}
