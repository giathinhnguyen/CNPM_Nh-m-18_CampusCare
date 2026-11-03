import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { CategoriesModule } from './categories/categories.module.js';
import { ProductsModule } from './products/products.module.js';
import { ToppingsModule } from './toppings/toppings.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { CartsModule } from './carts/carts.module.js';
import { PromotionsModule } from './promotions/promotions.module.js';
import { OrdersModule } from './orders/orders.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { RewardsModule } from './rewards/rewards.module.js';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    CategoriesModule,
    ProductsModule,
    ToppingsModule,
    AuthModule,
    UsersModule,
    CartsModule,
    PromotionsModule,
    OrdersModule,
    PaymentsModule,
    RewardsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }