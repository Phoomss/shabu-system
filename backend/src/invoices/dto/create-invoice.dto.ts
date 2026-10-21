import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateInvoiceDto {
  @ApiProperty({
    example: 'ses_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    description: 'Session ID (prefixed or raw UUID)',
  })
  @IsString()
  sessionId: string;

  @ApiProperty({
    example: 698.0,
    description:
      'Legacy display assertion only, never an authoritative charge. Checkout currently returns 503 pending approved policy.',
  })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  totalAmount: number;

  @ApiPropertyOptional({ example: 50, description: 'ส่วนลด' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  discount?: number;

  @ApiProperty({ example: 'เงินสด', description: 'วิธีชำระเงิน' })
  @IsString()
  paymentMethod: string;

  @ApiPropertyOptional({
    example: '08XXXXXXXX',
    description: 'เบอร์โทรศัพท์ PromptPay (สำหรับ QR_CODE)',
  })
  @IsOptional()
  @IsString()
  promptPayNumber?: string;
}
