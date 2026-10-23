import { Module } from '@nestjs/common';
import { ToppingsController } from './toppings.controller.js';
import { ToppingsService } from './toppings.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [ToppingsController],
  providers: [ToppingsService],
})
export class ToppingsModule {}
