import { PaymentSettingsDto } from './payment-settings.dto';
import { EmployeeResource } from '../security/access.decorators';
import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { Request } from 'express';
import { PolicyUser } from '../security/policy';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { SettingsService, PaymentSettings } from './settings.service';
import { JwtGuard } from 'src/auth/guards/jwt.guard';

@ApiTags('settings')
@ApiBearerAuth('JWT')
@UseGuards(JwtGuard)
@EmployeeResource('payment-settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('payment')
  @ApiOperation({
    summary:
      'Read stored, unverified receiver configuration; not proof of payment',
  })
  getPaymentSettings(): Promise<PaymentSettings> {
    return this.settingsService.getPaymentSettings();
  }

  @Post('payment')
  @ApiBody({ type: PaymentSettingsDto })
  @ApiOperation({
    summary:
      'Persist unverified receiver config; never generates QR or confirms payment',
  })
  updatePaymentSettings(
    @Body() dto: PaymentSettingsDto,
    @Req() req: Request,
  ): Promise<PaymentSettings> {
    return this.settingsService.updatePaymentSettings(
      dto,
      (req.user as PolicyUser).id,
    );
  }
}
