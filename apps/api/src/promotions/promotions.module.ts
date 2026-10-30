import { Module } from '@nestjs/common';
import { PromotionsController } from './promotions.controller.js';
import { PromotionsService } from './promotions.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CartSyncController } from './cart-sync.controller.js';
import { CartSyncService } from './cart-sync.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [PromotionsController, CartSyncController],
  providers: [PromotionsService, CartSyncService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
