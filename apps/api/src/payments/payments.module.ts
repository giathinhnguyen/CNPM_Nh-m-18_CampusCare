import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { OrdersModule } from '../orders/orders.module.js';
import { VnpayGateway } from './vnpay.gateway.js';

@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, VnpayGateway],
})
export class PaymentsModule {}
