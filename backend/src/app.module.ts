import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RoleModule } from './role/role.module';
import { UsersModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { KitechensModule } from './kitechens/kitechens.module';

@Module({
  imports: [
    ConfigModule.forRoot({isGlobal: true}),
    PrismaModule, 
    RoleModule, 
    UsersModule, 
    AuthModule, KitechensModule
  ],
})
export class AppModule {}
