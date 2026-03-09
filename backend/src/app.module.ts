import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RoleModule } from './role/role.module';
import { UsersModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [PrismaModule, RoleModule, UsersModule, AuthModule],
})
export class AppModule {}
