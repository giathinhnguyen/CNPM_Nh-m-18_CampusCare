import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PromotionsModule } from '../promotions/promotions.module.js';
import { InventoryModule } from '../inventory/inventory.module.js';
import { RewardsCartService } from '../rewards/rewards-cart.service.js';
import { CartsService } from './carts.service.js';

// Shared providers keep both controllers on one implementation without a module cycle.
@Module({
  imports: [PrismaModule, PromotionsModule, InventoryModule],
  providers: [CartsService, RewardsCartService],
  exports: [CartsService, RewardsCartService],
})
export class CartServicesModule {}
