import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsInt,
  ValidateNested,
  Min,
  Max,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_ITEM_QUANTITY, MAX_ORDER_ITEMS } from '../order-rules';

export class CreateOrderItemDto {
  @ApiProperty({ example: 'menu-item-uuid', description: 'Menu Item ID' })
  @IsString()
  menuItemId: string;

  @ApiProperty({
    example: 2,
    minimum: 1,
    maximum: MAX_ITEM_QUANTITY,
    description: 'จำนวนที่สั่ง',
  })
  @IsInt()
  @Min(1)
  @Max(MAX_ITEM_QUANTITY)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'session-uuid', description: 'Session ID' })
  @IsString()
  sessionId: string;

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
