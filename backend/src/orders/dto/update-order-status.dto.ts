import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class UpdateOrderStatusDto {
  @ApiProperty({
    enum: OrderStatus,
    example: OrderStatus.CONFIRMED,
    description:
      'Only PENDING -> CONFIRMED is enabled; cancellation is denied pending business approval. No implicit void/refund.',
  })
  @IsEnum(OrderStatus)
  status: OrderStatus;
}
