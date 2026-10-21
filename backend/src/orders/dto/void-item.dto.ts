import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

export class VoidItemDto {
  @ApiProperty({ example: 'ลูกค้าเปลี่ยนใจ', description: 'เหตุผลการยกเลิก' })
  @IsString()
  @MinLength(3)
  @MaxLength(1000)
  reason: string;
}
