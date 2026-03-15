import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsInt, IsOptional, IsUrl, IsBoolean, IsArray, MinLength } from "class-validator";

export class CreateMenuItemDto {
  @ApiProperty({ example: 1, description: 'Category ID' })
  @IsInt()
  categoryId: number;

  @ApiProperty({ example: 1, description: 'Kitchen ID' })
  @IsInt()
  kitchenId: number;

  @ApiProperty({ example: 'เนื้อวัวสไลด์' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ example: [1, 2], description: 'Tier IDs ที่สามารถสั่งได้' })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  tierIds?: number[];
}