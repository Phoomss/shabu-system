import { ApiProperty } from "@nestjs/swagger";
import { IsNumber, IsString } from "class-validator";
import { Type } from "class-transformer";

export class AdjustStockDto {
  @ApiProperty({ example: 500, description: 'จำนวนที่เพิ่ม/ลด (ติดลบได้)' })
  @IsNumber()
  @Type(() => Number)
  amount: number;

  @ApiProperty({ example: 'รับของเข้าคลัง', description: 'เหตุผล' })
  @IsString()
  reason: string;
}