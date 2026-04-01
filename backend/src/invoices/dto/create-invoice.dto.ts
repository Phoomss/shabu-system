import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNumber, IsOptional, Min } from "class-validator";
import { Type } from "class-transformer";

export class CreateInvoiceDto {
    @ApiProperty({ example: 'session-uuid' })
    @IsString()
    sessionId: string;

    @ApiProperty({ example: 698.00, description: 'ยอดรวมก่อนส่วนลด' })
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

    @ApiPropertyOptional({ example: '0839987275', description: 'เบอร์โทรศัพท์ PromptPay (สำหรับ QR_CODE)' })
    @IsOptional()
    @IsString()
    promptPayNumber?: string;
}