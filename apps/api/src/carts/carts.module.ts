import { Module } from '@nestjs/common';
import { CartsController } from './carts.controller.js';
import { CartsService } from './carts.service.js';
import { PrismaModule } from '../prisma/prisma.module.js'; // Nếu prisma có module riêng

@Module({
  imports: [PrismaModule], // Nếu PrismaModule là Global thì không cần dòng này
  controllers: [CartsController],
  providers: [CartsService],
  exports: [CartsService],
})
export class CartsModule { }
