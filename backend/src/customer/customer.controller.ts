import {
  Body,
  Controller,
  Get,
  Header,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { CustomerEndpoint } from '../security/access.decorators';
import { CustomerRequest } from '../security/access.guard';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from '../orders/orders.service';
import { CreateOrderItemDto } from '../orders/dto/create-order.dto';
import { CustomerAuthService } from './customer-auth.service';
import { customerOrder } from './customer-projection';
import { MAX_ORDER_ITEMS } from '../orders/order-rules';

class CustomerOrderDto {
  @ApiPropertyOptional({
    description:
      'Optional compatibility assertion. Must match the credential session.',
  })
  @IsOptional()
  @IsString()
  sessionId?: string;
  @ApiProperty({
    type: [CreateOrderItemDto],
    minItems: 1,
    maxItems: MAX_ORDER_ITEMS,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_ORDER_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
@ApiTags('customer')
@CustomerEndpoint()
@Controller('customer')
export class CustomerController {
  constructor(
    private readonly auth: CustomerAuthService,
    private readonly orders: OrdersService,
    private readonly prisma: PrismaService,
  ) {}
  @Get('orders')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Orders of the authenticated QR session only' })
  async list(
    @Req() req: CustomerRequest,
    @Query('sessionId') sessionId?: string,
  ) {
    this.auth.assertScope(req.customer, sessionId);
    return (await this.orders.findAll(req.customer.id)).map(customerOrder);
  }
  @Post('orders')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({
    summary: 'Create order for the authenticated QR session; no staff login',
  })
  async create(@Req() req: CustomerRequest, @Body() dto: CustomerOrderDto) {
    this.auth.assertScope(req.customer, dto.sessionId);
    return customerOrder(
      await this.orders.create({
        sessionId: req.customer.id,
        items: dto.items,
      }),
    );
  }
  @Get('menu-items')
  @Header('Cache-Control', 'no-store')
  @ApiOperation({ summary: 'Customer-safe menu fields for this session' })
  async menu(@Req() req: CustomerRequest) {
    const session = await this.prisma.session.findUniqueOrThrow({
      where: { id: req.customer.id },
      select: { tierId: true },
    });
    return this.prisma.menuItem.findMany({
      where: {
        isAvailable: true,
        tierItems: { some: { tierId: session.tierId } },
      },
      select: {
        id: true,
        name: true,
        imageUrl: true,
        isAvailable: true,
        category: { select: { id: true, name: true } },
      },
    });
  }
}
