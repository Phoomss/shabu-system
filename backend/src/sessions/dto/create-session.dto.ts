import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, Min } from "class-validator";

export class CreateSessionDto {
  @ApiProperty({ example: 1, description: 'Table ID' })
  @IsInt()
  tableId: number;

  @ApiProperty({ example: 1, description: 'Tier ID' })
  @IsInt()
  tierId: number;

  @ApiPropertyOptional({ example: 2, description: 'จำนวนผู้ใหญ่ (ค่าเริ่มต้น 1)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  adultCount?: number;

  @ApiPropertyOptional({ example: 1, description: 'จำนวนเด็ก (ค่าเริ่มต้น 0)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  childCount?: number;
}
