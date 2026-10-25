import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SessionStatus, TableStatus } from '@prisma/client';

// --- Child classes first (to avoid reference errors) ---

export class TableInfo {
  @ApiProperty({ example: 1, description: 'Table ID' })
  id: number;

  @ApiProperty({ example: 'A1' })
  number: string;

  @ApiPropertyOptional({ example: 'Zone A' })
  zone?: string;

  @ApiProperty({ enum: TableStatus })
  status: TableStatus;
}

export class TierInfo {
  @ApiProperty({ example: 1, description: 'Tier ID' })
  id: number;

  @ApiProperty({ example: 'Silver' })
  name: string;

  @ApiProperty({ example: 399.00 })
  priceAdult: number;

  @ApiProperty({ example: 199.00 })
  priceChild: number;

  @ApiProperty({ example: 90 })
  timeLimit: number;
}

export class OrderCountInfo {
  @ApiProperty({ example: 5 })
  orders: number;
}

// --- Main DTO classes ---

export class SessionResponse {
  @ApiProperty({ example: 'ses_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx', description: 'Session ID (prefixed)' })
  id: string;

  @ApiProperty({ example: 1, description: 'Session Number (sequential)' })
  sessionNumber: number;

  @ApiProperty({ example: 1, description: 'Table ID' })
  tableId: number;

  @ApiProperty({ example: 1, description: 'Tier ID' })
  tierId: number;

  @ApiProperty({ example: 'qr-token-uuid' })
  qrToken: string;

  @ApiProperty({ example: 2 })
  adultCount: number;

  @ApiProperty({ example: 1 })
  childCount: number;

  @ApiProperty({ example: '2024-01-15T10:00:00Z' })
  startTime: Date;

  @ApiProperty({ example: '2024-01-15T11:30:00Z' })
  endTime: Date;

  @ApiProperty({ enum: SessionStatus })
  status: SessionStatus;

  @ApiProperty({ type: () => TableInfo })
  table: TableInfo;

  @ApiProperty({ type: () => TierInfo })
  tier: TierInfo;

  @ApiPropertyOptional({ type: () => OrderCountInfo })
  _count?: {
    orders: number;
  };
}
