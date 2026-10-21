import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import {
  CustomerAuthService,
  CustomerIdentity,
} from '../customer/customer-auth.service';
import { PolicyUser } from './policy';
export type StaffIdentity = PolicyUser & {
  kind: 'staff';
  expiresAt: number;
  token: string;
};
export type SocketIdentity = StaffIdentity | CustomerIdentity;
@Injectable()
export class SocketIdentityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly customer: CustomerAuthService,
  ) {}
  async authenticate(auth: {
    accessToken?: unknown;
    customerToken?: unknown;
  }): Promise<SocketIdentity> {
    if (typeof auth?.customerToken === 'string' && !auth.accessToken)
      return this.customer.verify(auth.customerToken);
    if (typeof auth?.accessToken !== 'string' || auth.customerToken)
      throw new UnauthorizedException('Socket credentials required');
    let claims: { sub: string; exp: number; kind?: string };
    try {
      claims = await this.jwt.verifyAsync(auth.accessToken, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        algorithms: ['HS256'],
      });
      if (
        typeof claims.sub !== 'string' ||
        !Number.isInteger(claims.exp) ||
        (claims.kind && claims.kind !== 'access')
      )
        throw new Error();
    } catch {
      throw new UnauthorizedException('Invalid staff credential');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, isActive: true, role: { select: { name: true } } },
    });
    if (!user?.isActive)
      throw new UnauthorizedException('Invalid staff credential');
    return {
      kind: 'staff',
      id: user.id,
      role: user.role,
      token: auth.accessToken,
      expiresAt: claims.exp * 1000,
    };
  }
  revalidate(identity: SocketIdentity): Promise<SocketIdentity> {
    return this.authenticate(
      identity.kind === 'staff'
        ? { accessToken: identity.token }
        : { customerToken: identity.token },
    );
  }
}
