import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { OrdersModule } from '../orders/orders.module.js';
import { VnpayGateway } from './vnpay.gateway.js';
import { ZalopayGateway } from './zalopay.gateway.js';
import { ZalopayPaymentsService } from './zalopay-payments.service.js';
import { RefundsController } from './refunds.controller.js';
import { RefundsService } from './refunds.service.js';
import { RefundGateway } from './refund.gateway.js';

@Module({
  imports: [OrdersModule],
  controllers: [PaymentsController, RefundsController],
  providers: [PaymentsService, VnpayGateway, ZalopayGateway, ZalopayPaymentsService, RefundGateway, RefundsService],
})
export class PaymentsModule {}
