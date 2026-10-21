import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PermissionPolicy } from './policy';
import { AccessGuard } from './access.guard';
import { CustomerAuthService } from '../customer/customer-auth.service';
import { SocketIdentityService } from './socket-identity.service';
@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [
    PermissionPolicy,
    CustomerAuthService,
    SocketIdentityService,
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [PermissionPolicy, CustomerAuthService, SocketIdentityService],
})
export class SecurityModule {}
