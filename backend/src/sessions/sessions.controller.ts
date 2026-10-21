import { CustomerSessionResponse } from '../customer/customer-session.dto';
import {
  EmployeeResource,
  PublicEndpoint,
} from '../security/access.decorators';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { CustomerAuthService } from '../customer/customer-auth.service';
import { Header } from '@nestjs/common';
import { SessionsService } from './sessions.service';
import { CreateSessionDto, SessionResponse } from './dto/session-response.dto';
import { UpdateSessionStatusDto } from './dto/update-session-status.dto';
import { JwtGuard } from 'src/auth/guards/jwt.guard';

@ApiTags('sessions')
@EmployeeResource('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessionsService: SessionsService,
    private readonly customerAuth: CustomerAuthService,
  ) {}

  @Post()
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Open new session (เปิดโต๊ะ)' })
  @ApiResponse({ type: SessionResponse })
  create(@Body() dto: CreateSessionDto) {
    return this.sessionsService.create(dto);
  }

  @Get()
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get all sessions' })
  @ApiResponse({ type: [SessionResponse] })
  findAll() {
    return this.sessionsService.findAll();
  }

  @PublicEndpoint()
  @Header('Cache-Control', 'no-store')
  @Get('qr/:token')
  @ApiOperation({
    summary:
      'Exchange legacy QR for scoped customer credential + minimal session',
  })
  @ApiResponse({ type: CustomerSessionResponse })
  findByQrToken(@Param('token') token: string) {
    return this.customerAuth.exchange(token);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get session by id' })
  @ApiResponse({ type: SessionResponse })
  findOne(@Param('id') id: string) {
    return this.sessionsService.findOne(id);
  }

  @Patch(':id/status')
  @UseGuards(JwtGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Update session status [Socket]' })
  @ApiResponse({ type: SessionResponse })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateSessionStatusDto) {
    return this.sessionsService.updateStatus(id, dto);
  }
}
