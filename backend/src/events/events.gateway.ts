import { IncomingMessage } from 'node:http';
import {
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { HttpException } from '@nestjs/common';
import { IdTransformer, IdPrefix } from '../common/utils/id-transformer.util';
import {
  SocketIdentity,
  SocketIdentityService,
} from '../security/socket-identity.service';
import { PermissionPolicy } from '../security/policy';
import { allowedOrigin, corsOptions } from '../security/cors';
import { customerOrder } from '../customer/customer-projection';

type SocketData = { identity?: SocketIdentity };

@WebSocketGateway({
  cors: corsOptions,
  allowRequest: (
    request: IncomingMessage,
    callback: (error: string | null, success: boolean) => void,
  ) => callback(null, allowedOrigin(request.headers.origin)),
})
export class EventsGateway implements OnGatewayInit {
  constructor(
    private readonly ids: IdTransformer,
    private readonly identities: SocketIdentityService,
    private readonly policy: PermissionPolicy,
  ) {}
  @WebSocketServer() server: Server;
  afterInit(server: Server) {
    server.use((client, next) => {
      void this.initialize(client, next);
    });
  }
  private async initialize(
    client: Socket,
    next: (error?: Error) => void,
  ): Promise<void> {
    try {
      const identity = await this.identities.authenticate(
        client.handshake.auth,
      );
      (client.data as SocketData).identity = identity;
      if (identity.kind === 'staff') {
        if (this.policy.allows(identity, 'invoices.read'))
          await client.join('staff:invoices');
        if (this.policy.allows(identity, 'ingredients.read'))
          await client.join('staff:stock');
        if (this.policy.allows(identity, 'tables.read'))
          await client.join('staff:tables');
      }
      const timer = setTimeout(
        () => client.disconnect(true),
        Math.max(0, identity.expiresAt - Date.now()),
      );
      timer.unref();
      client.once('disconnect', () => clearTimeout(timer));
      next();
    } catch (error) {
      const denied = new Error('Socket authentication failed') as Error & {
        data: { status: number };
      };
      denied.data = {
        status: error instanceof HttpException ? error.getStatus() : 401,
      };
      next(denied);
    }
  }
  private async current(client: Socket): Promise<SocketIdentity> {
    if (!(client.data as SocketData).identity)
      throw new WsException({
        statusCode: 401,
        message: 'Socket authentication required',
      });
    try {
      const identity = await this.identities.revalidate(
        (client.data as SocketData).identity as SocketIdentity,
      );
      (client.data as SocketData).identity = identity;
      return identity;
    } catch {
      client.disconnect(true);
      throw new WsException({
        statusCode: 401,
        message: 'Socket credential no longer valid',
      });
    }
  }
  @SubscribeMessage('kitchen:join')
  async handleKitchenJoin(
    @MessageBody() data: { kitchenId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const identity = await this.current(client);
    try {
      const kitchenId = this.ids.decodeInt(data?.kitchenId, IdPrefix.KITCHEN);
      if (identity.kind !== 'staff')
        throw new WsException({
          statusCode: 403,
          message: 'Kitchen access denied',
        });
      this.policy.assertKitchen(identity, kitchenId, 'kitchen.orders.read');
      const room = `kitchen:${kitchenId}`;
      await client.join(room);
      return { event: 'kitchen:joined', data: { room }, room };
    } catch (error) {
      this.fail(error);
    }
  }
  @SubscribeMessage('session:join')
  async handleSessionJoin(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const identity = await this.current(client);
    try {
      const sessionId = this.ids.decode(data?.sessionId, IdPrefix.SESSION);
      if (identity.kind === 'customer') {
        if (identity.id !== sessionId)
          throw new WsException({
            statusCode: 403,
            message: 'Session access denied',
          });
      } else this.policy.assert(identity, 'sessions.read');
      const room = `session:${sessionId}`;
      await client.join(room);
      return { event: 'session:joined', data: { room }, room };
    } catch (error) {
      this.fail(error);
    }
  }
  private fail(error: unknown): never {
    if (error instanceof WsException) throw error;
    throw new WsException({
      statusCode: error instanceof HttpException ? error.getStatus() : 403,
      message: 'Room access denied',
    });
  }
  /** Revalidate recipients before delivery so role changes/closure also revoke existing rooms. */
  private async deliver(
    room: string | undefined,
    event: string,
    payload: unknown,
    authorize: (identity: SocketIdentity) => boolean,
    customerPayload: unknown = payload,
  ) {
    try {
      const recipients = room
        ? await this.server.in(room).fetchSockets()
        : await this.server.fetchSockets();
      await Promise.all(
        recipients.map(async (client) => {
          try {
            const identity = await this.identities.revalidate(
              (client.data as SocketData).identity as SocketIdentity,
            );
            if (authorize(identity))
              client.emit(
                event,
                identity.kind === 'customer' ? customerPayload : payload,
              );
          } catch {
            client.disconnect(true);
          }
        }),
      );
    } catch {
      /* Server may be shutting down; never send unfiltered fallback broadcasts. */
    }
  }
  emitMenuAvailability(menuItemId: string, isAvailable: boolean, name: string) {
    return this.deliver(
      undefined,
      'menu:availability_changed',
      { menuItemId, isAvailable, name },
      (id) => id.kind === 'customer' || this.policy.allows(id, 'menu.read'),
    );
  }
  emitNewOrderItem(kitchenId: number, orderItem: unknown) {
    return this.deliver(
      `kitchen:${kitchenId}`,
      'kitchen:new_order',
      orderItem,
      (id) =>
        id.kind === 'staff' &&
        this.policy.kitchenIds(id).includes(kitchenId) &&
        this.policy.allows(id, 'kitchen.orders.read'),
    );
  }
  emitVoidOrderItem(kitchenId: number, orderItem: unknown) {
    return this.deliver(
      `kitchen:${kitchenId}`,
      'kitchen:void_order',
      orderItem,
      (id) =>
        id.kind === 'staff' &&
        this.policy.kitchenIds(id).includes(kitchenId) &&
        this.policy.allows(id, 'kitchen.orders.read'),
    );
  }
  emitOrderStatus(
    sessionId: string,
    order: Parameters<typeof customerOrder>[0],
  ) {
    return this.deliver(
      `session:${sessionId}`,
      'order:status_changed',
      order,
      (id) =>
        id.kind === 'customer'
          ? id.id === sessionId
          : this.policy.allows(id, 'sessions.read'),
      customerOrder(order),
    );
  }
  emitItemStatus(
    sessionId: string,
    item: {
      orderItemId: string;
      orderId: string;
      status: string;
      menuItem?: { id: string; name: string };
      [key: string]: unknown;
    },
  ) {
    const safe = {
      orderItemId: item.orderItemId,
      orderId: item.orderId,
      status: item.status,
      ...(item.menuItem
        ? { menuItem: { id: item.menuItem.id, name: item.menuItem.name } }
        : {}),
    };
    return this.deliver(
      `session:${sessionId}`,
      'order:item_status_changed',
      item,
      (id) =>
        id.kind === 'customer'
          ? id.id === sessionId
          : this.policy.allows(id, 'sessions.read'),
      safe,
    );
  }
  emitTableStatus(tableId: number, status: string) {
    return this.deliver(
      'staff:tables',
      'table:status_changed',
      { tableId, status },
      (id) => id.kind === 'staff' && this.policy.allows(id, 'tables.read'),
    );
  }
  emitSessionStatus(sessionId: string, status: string) {
    return this.deliver(
      `session:${sessionId}`,
      'session:status_changed',
      { sessionId, status },
      (id) =>
        id.kind === 'customer'
          ? id.id === sessionId
          : this.policy.allows(id, 'sessions.read'),
    );
  }
  emitSessionWarning(sessionId: string, minutesLeft: number) {
    return this.deliver(
      `session:${sessionId}`,
      'session:time_warning',
      { sessionId, minutesLeft },
      (id) =>
        id.kind === 'customer'
          ? id.id === sessionId
          : this.policy.allows(id, 'sessions.read'),
    );
  }
  emitLowStock(data: {
    ingredientId: number;
    name: string;
    currentStock: number;
    unit: string;
    isEmpty: boolean;
  }) {
    return this.deliver(
      'staff:stock',
      'ingredient:low_stock',
      data,
      (id) => id.kind === 'staff' && this.policy.allows(id, 'ingredients.read'),
    );
  }
  emitNewInvoice(data: {
    invoiceId: string;
    netAmount: number;
    paymentMethod: string;
    tableNumber: string;
    createdAt: Date;
  }) {
    return this.deliver(
      'staff:invoices',
      'invoice:new',
      data,
      (id) => id.kind === 'staff' && this.policy.allows(id, 'invoices.read'),
    );
  }
}
