import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

// --- Child classes first (to avoid reference errors) ---

export class SessionInfo {
  @ApiProperty({ example: 'ses_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', description: 'Session ID (prefixed)' })
  id: string;

  @ApiProperty({ example: 1, description: 'Session Number (sequential)' })
  sessionNumber: number;

  @ApiProperty({ example: 'tbl_000001', description: 'Table ID (prefixed)' })
  tableId: number;

  @ApiProperty({ example: 'tier_1', description: 'Tier ID (prefixed)' })
  tierId: number;

  @ApiProperty({ example: 'A1' })
  tableNumber: string;

  @ApiProperty({ example: 'Silver' })
  tierName: string;

  @ApiProperty({ example: 399.00 })
  tierPrice: number;
}

// --- Main DTO classes ---

export class InvoiceResponse {
  @ApiProperty({ example: 'inv_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', description: 'Invoice ID (prefixed)' })
  id: string;

  @ApiProperty({ example: 1, description: 'Invoice Number (sequential)' })
  invoiceNumber: number;

  @ApiProperty({ example: 'ses_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', description: 'Session ID (prefixed)' })
  sessionId: string;

  @ApiProperty({ example: 698.00 })
  totalAmount: number;

  @ApiProperty({ example: 50.00 })
  discount: number;

  @ApiProperty({ example: 648.00 })
  netAmount: number;

  @ApiProperty({ example: 'เงินสด' })
  paymentMethod: string;

  @ApiPropertyOptional({ example: '0839987275' })
  promptPayNumber?: string;

  @ApiProperty({ example: 'usr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', description: 'Created by User ID (prefixed)' })
  createdBy: string;

  @ApiProperty({ example: 'John Doe' })
  creatorName: string;

  @ApiProperty({ example: '2024-01-15T10:30:00Z' })
  createdAt: Date;

  @ApiProperty({ type: () => SessionInfo })
  session: SessionInfo;
}
