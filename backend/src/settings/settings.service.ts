import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { hasControlCharacters } from './receiver-reference';

export interface PaymentSettings {
  promptPayNumber: string | null;
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getPaymentSettings(): Promise<PaymentSettings> {
    const settings = await this.prisma.paymentSettings.findUnique({
      where: { id: 1 },
    });
    return {
      promptPayNumber: settings?.promptPayNumber ?? null,
    };
  }

  async updatePaymentSettings(
    dto: PaymentSettings,
    actorId: string,
  ): Promise<PaymentSettings> {
    if (
      dto.promptPayNumber !== null &&
      (typeof dto.promptPayNumber !== 'string' ||
        !dto.promptPayNumber.trim() ||
        dto.promptPayNumber.trim().length > 64 ||
        hasControlCharacters(dto.promptPayNumber.trim()))
    )
      throw new BadRequestException(
        'Receiver reference must be null or a non-empty string without controls, max 64 characters',
      );
    const promptPayNumber = dto.promptPayNumber?.trim() ?? null;
    const settings = await this.prisma.paymentSettings.upsert({
      where: { id: 1 },
      create: { id: 1, promptPayNumber, updatedBy: actorId },
      update: { promptPayNumber, updatedBy: actorId },
    });
    return {
      promptPayNumber: settings.promptPayNumber,
    };
  }
}
