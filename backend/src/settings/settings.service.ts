import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

export interface PaymentSettings {
  promptPayNumber: string | null;
}

@Injectable()
export class SettingsService {
  private promptPayNumber: string | null = null;

  constructor(private prisma: PrismaService) {}

  async getPaymentSettings(): Promise<PaymentSettings> {
    return {
      promptPayNumber: this.promptPayNumber,
    };
  }

  async updatePaymentSettings(dto: PaymentSettings): Promise<PaymentSettings> {
    this.promptPayNumber = dto.promptPayNumber;
    return {
      promptPayNumber: this.promptPayNumber,
    };
  }
}
