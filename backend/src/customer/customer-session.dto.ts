import { ApiProperty } from '@nestjs/swagger';
class CustomerTable {
  @ApiProperty() id: string;
  @ApiProperty() number: string;
}
class CustomerTier {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
}
export class CustomerSessionResponse {
  @ApiProperty({ description: 'Opaque session ID; never a credential' })
  id: string;
  @ApiProperty() status: string;
  @ApiProperty() startTime: Date;
  @ApiProperty() endTime: Date;
  @ApiProperty({ type: CustomerTable }) table: CustomerTable;
  @ApiProperty({ type: CustomerTier }) tier: CustomerTier;
  @ApiProperty({
    description: 'Short-lived session-scoped customer bearer; keep in memory',
  })
  customerAccessToken: string;
  @ApiProperty({ format: 'date-time' }) credentialExpiresAt: string;
}
