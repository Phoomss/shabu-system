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
import { MenuItemModule } from './menu-item/menu-item.module';
import { TablesModule } from './tables/tables.module';
import { SessionsModule } from './sessions/sessions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { OrdersModule } from './orders/orders.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { InvoicesModule } from './invoices/invoices.module';
import { SettingsModule } from './settings/settings.module';


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    EventsModule,
    RoleModule,
    UsersModule,
    AuthModule,
    KitchensModule,
    CategoriesModule,
    TiersModule,
    MenuItemModule,
    TablesModule,
    SessionsModule,
    OrdersModule,
    IngredientsModule,
    InvoicesModule,
    SettingsModule
  ],
})
export class AppModule { }
