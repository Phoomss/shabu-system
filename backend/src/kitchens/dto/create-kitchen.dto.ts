import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class CreateKitchenDto {
    @ApiProperty({ example: 'HOT_KITCHEN', description: 'ชื่อแผนกครัว' })
    @IsString()
    @MinLength(2)
    name: string;
}