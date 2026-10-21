import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { CustomerController } from './customer.controller';
@Module({ imports: [OrdersModule], controllers: [CustomerController] })
export class CustomerModule {}
