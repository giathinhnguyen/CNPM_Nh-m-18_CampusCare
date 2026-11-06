import { Module } from '@nestjs/common';
import { CartsController } from './carts.controller.js';
import { CartServicesModule } from './cart-services.module.js';

@Module({
  imports: [CartServicesModule],
  controllers: [CartsController],
  exports: [CartServicesModule],
})
export class CartsModule { }
