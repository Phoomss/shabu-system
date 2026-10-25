import { ApiProperty } from "@nestjs/swagger";
import { IsString, IsArray, IsInt, IsOptional, ValidateNested, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateOrderItemDto {
  @ApiProperty({ example: 'menu-item-uuid', description: 'Menu Item ID' })
  @IsString()
  menuItemId: string;

  @ApiProperty({ example: 2, description: 'จำนวนที่สั่ง' })
  @IsInt()
  @Min(1)
  quantity: number;

  // Accepted for POS compatibility; the server uses the menu item's kitchenId.
  @IsOptional()
  @IsInt()
  kitchenId?: number;
}

export class CreateOrderDto {
  @ApiProperty({ example: 'session-uuid', description: 'Session ID' })
  @IsString()
  sessionId: string;

  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];
}
