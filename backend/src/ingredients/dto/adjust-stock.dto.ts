import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsString,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { Type } from 'class-transformer';

export class AdjustStockDto {
  @ApiProperty({ example: 500, description: 'จำนวนที่เพิ่ม/ลด (ติดลบได้)' })
  @IsNumber()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: 'รับของเข้าคลัง', description: 'เหตุผล' })
  @IsString()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MinLength(3)
  @MaxLength(1000)
  reason: string;

  @ApiProperty({
    description: 'Stable business-event UUID; reuse unchanged on retry',
  })
  @IsUUID()
  reference: string;
}
