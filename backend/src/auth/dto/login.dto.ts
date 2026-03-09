import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";

export class LoginDto {
    @ApiProperty({ example: 'juho_doe' })
    @IsString()
    username: string

    @ApiProperty({ example: 'password123' })
    @IsString()
    @MinLength(6)
    password: string
}