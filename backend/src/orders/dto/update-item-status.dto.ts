import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ItemStatus } from '@prisma/client';

export class UpdateItemStatusDto {
  @ApiProperty({
    enum: [ItemStatus.PREPARING, ItemStatus.SERVED],
    example: ItemStatus.PREPARING,
    description:
      'Forward transitions only. VOIDED requires POST /orders/items/:itemId/void with actor/reason audit.',
  })
  @IsIn([ItemStatus.PREPARING, ItemStatus.SERVED])
  status: ItemStatus;
}
