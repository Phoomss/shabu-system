import { createHash, createHmac } from 'node:crypto';
import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { IdPrefix, IdTransformer } from '../common/utils/id-transformer.util';
import { assertSigningConfiguration } from '../security/signing-config';

export type CustomerClaims = {
  kind: 'customer';
  sub: string;
  qrBinding: string;
  exp: number;
};
export type CustomerIdentity = {
  kind: 'customer';
  id: string;
  expiresAt: number;
  token: string;
};
@Injectable()
export class CustomerAuthService {
  private readonly secret: string;
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    config: ConfigService,
    private readonly ids: IdTransformer,
  ) {
    assertSigningConfiguration(config);
    if (
      config.get<string>('JWT_SECRET') ===
      config.get<string>('JWT_REFRESH_SECRET')
    )
      throw new Error('Staff and refresh signing keys must be separate');
    // Separate signing domain: a customer token cannot verify as a staff JWT.
    this.secret =
      config.get<string>('CUSTOMER_JWT_SECRET') ||
      createHmac('sha256', config.getOrThrow<string>('JWT_SECRET'))
        .update('shabu:customer-session:v1')
        .digest('hex');
    if (
      this.secret === config.get<string>('JWT_SECRET') ||
      this.secret === config.get<string>('JWT_REFRESH_SECRET')
    )
      throw new Error('Customer signing key must be separate');
  }
  private binding(qrToken: string): string {
    return createHash('sha256').update(qrToken).digest('hex');
  }
  async exchange(qrToken: string) {
    if (typeof qrToken !== 'string' || qrToken.length > 128)
      throw new UnauthorizedException('Invalid QR credential');
    const session = await this.prisma.session.findUnique({
      where: { qrToken },
      include: { table: true, tier: true },
    });
    if (!session) throw new UnauthorizedException('Invalid QR credential');
    this.assertActive(session);
    const seconds = Math.min(
      15 * 60,
      Math.floor((session.endTime.getTime() - Date.now()) / 1000),
    );
    if (seconds < 1)
      throw new ForbiddenException('Session is no longer active');
    const customerAccessToken = await this.jwt.signAsync(
      {
        kind: 'customer',
        sub: session.id,
        qrBinding: this.binding(session.qrToken),
      },
      {
        secret: this.secret,
        algorithm: 'HS256',
        audience: 'shabu-customer',
        issuer: 'shabu-api',
        expiresIn: seconds,
      },
    );
    return {
      id: this.ids.encode(session.id, IdPrefix.SESSION),
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime,
      table: {
        id: this.ids.encodeInt(session.tableId, IdPrefix.TABLE),
        number: session.table.number,
      },
      tier: {
        id: this.ids.encodeInt(session.tierId, IdPrefix.TIER),
        name: session.tier.name,
      },
      customerAccessToken,
      credentialExpiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
    };
  }
  async verify(token: string): Promise<CustomerIdentity> {
    let claims: CustomerClaims;
    try {
      claims = await this.jwt.verifyAsync<CustomerClaims>(token, {
        secret: this.secret,
        algorithms: ['HS256'],
        audience: 'shabu-customer',
        issuer: 'shabu-api',
      });
      if (
        claims.kind !== 'customer' ||
        !Number.isInteger(claims.exp) ||
        typeof claims.qrBinding !== 'string'
      )
        throw new Error();
      this.ids.decode(claims.sub, IdPrefix.SESSION);
    } catch {
      throw new UnauthorizedException('Invalid customer credential');
    }
    const session = await this.prisma.session.findUnique({
      where: { id: claims.sub },
    });
    if (!session || this.binding(session.qrToken) !== claims.qrBinding)
      throw new UnauthorizedException('Invalid customer credential');
    this.assertActive(session);
    return {
      kind: 'customer',
      id: session.id,
      expiresAt: claims.exp * 1000,
      token,
    };
  }
  assertScope(identity: CustomerIdentity, value?: string): void {
    if (
      value !== undefined &&
      this.ids.decode(value, IdPrefix.SESSION) !== identity.id
    )
      throw new ForbiddenException('Session access denied');
  }
  private assertActive(session: { status: string; endTime: Date }): void {
    if (session.status !== 'ACTIVE' || session.endTime.getTime() <= Date.now())
      throw new ForbiddenException('Session is no longer active');
  }
}
