import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PublicEndpoint } from './security/access.decorators';
import { PrismaService } from './prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @PublicEndpoint()
  @Get()
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}
