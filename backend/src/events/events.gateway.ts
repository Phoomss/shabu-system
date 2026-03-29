import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  // ครัวเข้า join room ของตัวเอง
  @SubscribeMessage('kitchen:join')
  handleKitchenJoin(
    @MessageBody() data: { kitchenId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `kitchen:${data.kitchenId}`;
    client.join(room);
    console.log(`✅ [Socket] Kitchen client ${client.id} joined room: ${room}`);
    return { event: 'kitchen:joined', room };
  }

  // โต๊ะ/ลูกค้า join room ของ session
  @SubscribeMessage('session:join')
  handleSessionJoin(
    @MessageBody() data: { sessionId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const room = `session:${data.sessionId}`;
    client.join(room);
    console.log(`Client ${client.id} joined room: ${room}`);
    return { event: 'session:joined', room };
  }

  // --- Emit methods (เรียกจาก service อื่น) ---

  // [MenuItem] แจ้งทุก client เมื่อเมนูหมด/มีของ
  emitMenuAvailability(menuItemId: string, isAvailable: boolean, name: string) {
    this.server.emit('menu:availability_changed', {
      menuItemId,
      isAvailable,
      name,
    });
  }

  // [Order] แจ้งครัวเมื่อมี order item ใหม่
  emitNewOrderItem(kitchenId: number, orderItem: any) {
    const room = `kitchen:${kitchenId}`;
    console.log(`📡 [Socket] Emitting new order to room: ${room}`);
    console.log(`📦 [Socket] Order data:`, orderItem);
    this.server.to(room).emit('kitchen:new_order', orderItem);
  }

  // [Order] แจ้งครัวเมื่อ order item ถูก void
  emitVoidOrderItem(kitchenId: number, orderItem: any) {
    this.server.to(`kitchen:${kitchenId}`).emit('kitchen:void_order', orderItem);
  }

  // [Order] แจ้ง session เมื่อ order status เปลี่ยน
  emitOrderStatus(sessionId: string, order: any) {
    this.server
      .to(`session:${sessionId}`)
      .emit('order:status_changed', order);
  }

  // [OrderItem] แจ้ง session เมื่อ item status เปลี่ยน
  emitItemStatus(sessionId: string, orderItem: any) {
    this.server
      .to(`session:${sessionId}`)
      .emit('order:item_status_changed', orderItem);
  }

  // [Table] แจ้งทุก client เมื่อ table status เปลี่ยน
  emitTableStatus(tableId: number, status: string) {
    this.server.emit('table:status_changed', { tableId, status });
  }

  // เพิ่มใน events.gateway.ts
  emitSessionStatus(sessionId: string, status: string) {
    this.server
      .to(`session:${sessionId}`)
      .emit('session:status_changed', { sessionId, status });
  }

  emitSessionWarning(sessionId: string, minutesLeft: number) {
    this.server
      .to(`session:${sessionId}`)
      .emit('session:time_warning', { sessionId, minutesLeft });
  }

  // [Ingredient] แจ้งเตือน stock ต่ำ
  emitLowStock(data: {
    ingredientId: number;
    name: string;
    currentStock: number;
    unit: string;
    isEmpty: boolean;
  }) {
    this.server.emit('ingredient:low_stock', data);
  }

  // [Invoice] แจ้ง dashboard owner เมื่อมียอดใหม่
  emitNewInvoice(data: {
    invoiceId: string;
    netAmount: number;
    paymentMethod: string;
    tableNumber: string;
    createdAt: Date;
  }) {
    this.server.emit('invoice:new', data);
  }
}