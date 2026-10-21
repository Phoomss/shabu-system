import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithRequest } from 'passport-jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(
  Strategy,
  'jwt-refresh',
) {
  constructor(
    private prisma: PrismaService,
    config: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.refresh_token ?? null,
      ]),
      algorithms: ['HS256'],
      secretOrKey: config.getOrThrow<string>('JWT_REFRESH_SECRET'), // ← getOrThrow
      passReqToCallback: true,
    } as StrategyOptionsWithRequest); // ← cast เป็น StrategyOptionsWithRequest
  }

  async validate(req: Request, payload: { sub: string; kind?: string }) {
    if (payload.kind && payload.kind !== 'refresh')
      throw new UnauthorizedException();
    const refreshToken = req.cookies?.refresh_token;
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { role: true },
    });

    if (!user || !user.refreshToken || !user.isActive)
      throw new UnauthorizedException();

    const isMatch = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isMatch) throw new UnauthorizedException();

    return user;
  }
}
