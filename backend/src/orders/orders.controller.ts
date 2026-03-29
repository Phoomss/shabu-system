import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Query,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateItemStatusDto } from './dto/update-item-status.dto';
import { VoidItemDto } from './dto/void-item.dto';
import { JwtGuard } from 'src/auth/guards/jwt.guard';

@ApiTags('orders')
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // ─── Order ───────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create order (ลูกค้าสั่งอาหาร) [Socket]' })
  create(@Body() dto: CreateOrderDto) {
    return this.ordersService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all orders (public when sessionId provided)' })
  @ApiQuery({ name: 'sessionId', required: false })
  findAll(@Query('sessionId') sessionId?: string) {
    return this.ordersService.findAll(sessionId);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get order by id' })
  findOne(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update order status [Socket]' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.ordersService.updateStatus(id, dto);
  }

  // ─── OrderItem ────────────────────────────────────────────

  @Get('kitchen/:kitchenId')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get pending items by kitchen (KDS)' })
  findItemsByKitchen(@Param('kitchenId', ParseIntPipe) kitchenId: number) {
    return this.ordersService.findItemsByKitchen(kitchenId);
  }

  @Patch('items/:itemId/status')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update item status (ครัวอัปเดต) [Socket]' })
  updateItemStatus(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemStatusDto,
  ) {
    return this.ordersService.updateItemStatus(itemId, dto);
  }

  @Post('items/:itemId/void')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Void order item (Manager อนุมัติ) [Socket]' })
  voidItem(
    @Param('itemId') itemId: string,
    @Body() dto: VoidItemDto,
    @Req() req: Request,
  ) {
    const user = req.user as any;
    return this.ordersService.voidItem(itemId, dto, user.id);
  }

  @Get('void-logs')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get all void logs' })
  findVoidLogs() {
    return this.ordersService.findVoidLogs();
  }
}