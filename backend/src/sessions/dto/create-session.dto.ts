import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class CreateSessionDto {
  @ApiProperty({ example: 1, description: 'Table ID' })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  tableId: number;

  @ApiProperty({ example: 1, description: 'Tier ID' })
  @IsInt()
  @Min(1)
  @Max(2147483647)
  tierId: number;

  @ApiProperty({ example: 2, description: 'จำนวนผู้ใหญ่' })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  adultCount: number;

  @ApiProperty({ example: 1, description: 'จำนวนเด็ก' })
  @IsInt()
  @Min(0)
  @Max(2147483647)
  childCount: number;
}
