import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { RoleModule } from './role/role.module';
import { UsersModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { KitchensModule } from './kitchens/kitchens.module';
import { CategoriesModule } from './categories/categories.module';
import { TiersModule } from './tiers/tiers.module';
import { EventsModule } from './events/events.module';
import { MenuItemsModule } from './menu_items/menu_items.module';
import { MenuItemModule } from './menu-item/menu-item.module';
import { MenuItemModule } from './menu-item/menu-item.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    EventsModule,
    RoleModule,
    UsersModule,
    AuthModule,
    KitchensModule,
    CategoriesModule,
    TiersModule,
    MenuItemsModule,
    MenuItemModule
  ],
})
export class AppModule { }
