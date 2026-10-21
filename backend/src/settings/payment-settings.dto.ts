import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MaxLength,
  MinLength,
  ValidateBy,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { hasControlCharacters } from './receiver-reference';
export class PaymentSettingsDto {
  @ApiProperty({
    nullable: true,
    description:
      'Unverified legacy receiver reference, not an approved QR payload. Explicit null clears it; otherwise a trimmed non-empty string without controls, max 64 characters.',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_object, value: unknown) => value !== null)
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @ValidateBy({
    name: 'noControlCharacters',
    validator: {
      validate: (value: unknown) =>
        typeof value === 'string' && !hasControlCharacters(value),
    },
  })
  promptPayNumber: string | null;
}
