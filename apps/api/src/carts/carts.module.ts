import { Module } from '@nestjs/common';
import { CartsController } from './carts.controller.js';
import { CartsService } from './carts.service.js';
import { PrismaModule } from '../prisma/prisma.module.js'; // Nếu prisma có module riêng
import { PromotionsModule } from '../promotions/promotions.module.js';
import { CartQuotesService } from './cart-quotes.service.js';

@Module({
  imports: [PrismaModule, PromotionsModule],
  controllers: [CartsController],
  providers: [CartsService, CartQuotesService],
  exports: [CartsService],
})
export class CartsModule { }
