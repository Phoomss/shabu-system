import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { SettingsService, PaymentSettings } from './settings.service';
import { JwtGuard } from 'src/auth/guards/jwt.guard';

@ApiTags('settings')
@ApiBearerAuth('JWT')
@UseGuards(JwtGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('payment')
  @ApiOperation({ summary: 'Get payment settings (PromptPay number)' })
  getPaymentSettings(): Promise<PaymentSettings> {
    return this.settingsService.getPaymentSettings();
  }

  @Post('payment')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        promptPayNumber: {
          type: 'string',
          example: '08XXXXXXXX',
          description: 'เบอร์โทรศัพท์ PromptPay',
        },
      },
    },
  })
  @ApiOperation({ summary: 'Update payment settings (PromptPay number)' })
  updatePaymentSettings(@Body() dto: PaymentSettings): Promise<PaymentSettings> {
    return this.settingsService.updatePaymentSettings(dto);
  }
}
