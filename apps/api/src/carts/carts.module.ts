import { Module } from '@nestjs/common';
import { CartsController } from './carts.controller.js';
import { CartsService } from './carts.service.js';
import { PrismaModule } from '../prisma/prisma.module.js'; // Nếu prisma có module riêng
import { CartSyncController } from './cart-sync.controller.js';
import { CartSyncService } from './cart-sync.service.js';

@Module({
  imports: [PrismaModule], // Nếu PrismaModule là Global thì không cần dòng này
  controllers: [CartsController, CartSyncController],
  providers: [CartsService, CartSyncService],
  exports: [CartsService],
})
export class CartsModule { }
