import { Module } from '@nestjs/common';
import { RewardsController } from './rewards.controller.js';
import { RewardsService } from './rewards.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CartServicesModule } from '../carts/cart-services.module.js';
import { RewardsCartController } from './rewards-cart.controller.js';
import { InventoryModule } from '../inventory/inventory.module.js';

@Module({
  imports: [PrismaModule, CartServicesModule, InventoryModule],
  controllers: [RewardsController, RewardsCartController],
  providers: [RewardsService]
})
export class RewardsModule {}
