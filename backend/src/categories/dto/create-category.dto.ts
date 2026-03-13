import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsOptional, IsUrl, MinLength } from "class-validator";

export class CreateCategoryDto {
  @ApiProperty({ example: 'เนื้อวัว', description: 'ชื่อหมวดหมู่' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'https://example.com/icon.png' })
  @IsOptional()
  @IsUrl()
  iconUrl?: string;
}