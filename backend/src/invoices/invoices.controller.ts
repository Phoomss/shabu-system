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

@ApiTags('invoices')
@ApiBearerAuth('JWT')
@UseGuards(JwtGuard)
@EmployeeResource('invoices')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @ApiOperation({ summary: 'Create invoice (เก็บเงิน) [Socket]' })
  @ApiResponse({ type: InvoiceResponse })
  create(@Body() dto: CreateInvoiceDto, @Req() req: Request) {
    const user = req.user as any;
    return this.invoicesService.create(dto, user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get all invoices' })
  @ApiResponse({ type: [InvoiceResponse] })
  findAll() {
    return this.invoicesService.findAll();
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
