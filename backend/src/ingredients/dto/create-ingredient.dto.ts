import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsNumber, IsOptional, IsUrl, Min, MinLength } from "class-validator";
import { Type } from "class-transformer";

export class CreateIngredientDto {
  @ApiProperty({ example: 'เนื้อวัว' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiProperty({ example: 'กรัม', description: 'หน่วยนับ' })
  @IsString()
  unit: string;

  @ApiProperty({ example: 5000, description: 'จำนวนสต็อกเริ่มต้น' })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  currentStock: number;

  @ApiPropertyOptional({ example: 'https://example.com/image.jpg' })
  @IsOptional()
  @IsUrl()
  imageUrl?: string;
}