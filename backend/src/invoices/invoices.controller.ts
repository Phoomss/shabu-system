import { EmployeeResource } from '../security/access.decorators';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { Request } from 'express';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceResponse } from './dto/invoice-response.dto';
import { JwtGuard } from 'src/auth/guards/jwt.guard';
import { PermissionPolicy, PolicyUser } from '../security/policy';
import { PAYMENT_READINESS } from './payment-readiness';

@ApiTags('invoices')
@ApiBearerAuth('JWT')
@UseGuards(JwtGuard)
@EmployeeResource('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly policy: PermissionPolicy,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Checkout disabled pending approved pricing/payment policy; no financial writes',
  })
  @ApiResponse({ status: 503, description: 'CHECKOUT_POLICY_PENDING' })
  create(@Body() dto: CreateInvoiceDto, @Req() req: Request) {
    const user = req.user as PolicyUser;
    if ((dto.discount ?? 0) > 0) this.policy.assert(user, 'invoices.discount');
    return this.invoicesService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all invoices' })
  @ApiResponse({ type: [InvoiceResponse] })
  findAll() {
    return this.invoicesService.findAll();
  }

  @Get('payment-readiness')
  @ApiOperation({
    summary:
      'Read-only payment readiness; never returns a guessed quote or marks PAID',
  })
  readiness() {
    return PAYMENT_READINESS;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get invoice by id' })
  @ApiResponse({ type: InvoiceResponse })
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Get('stats/total-revenue')
  @ApiOperation({ summary: 'Get total revenue (SUM of netAmount)' })
  getTotalRevenue() {
    return this.invoicesService.getTotalRevenue();
  }
}
