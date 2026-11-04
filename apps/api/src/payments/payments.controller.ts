import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PaymentsService } from './payments.service.js';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Get('config') config() {
    return this.payments.config();
  }
  @Get(':id/order')
  @UseGuards(AuthGuard)
  order(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.payments.orderForPayment(req.user.id, id);
  }
  @Get('vnpay/ipn') ipn(@Query() query: Record<string, unknown>) {
    return this.payments.notification(query);
  }
  @Post('vnpay/return')
  @UseGuards(AuthGuard)
  returned(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.payments.handleReturn(req.user.id, body);
  }
  @Post('vnpay/result')
  result(@Body() body: unknown) {
    return this.payments.publicReturn(body);
  }
  @Post()
  @UseGuards(AuthGuard)
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.payments.create(req.user.id, body, req.ip ?? '127.0.0.1');
  }
  @Post('orders/:id/reconcile')
  @UseGuards(AuthGuard)
  reconcile(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.payments.reconcile(req.user.id, id);
  }
  @Post('orders/:id/bank-transfer-demo/confirm')
  @UseGuards(AuthGuard)
  confirmBankTransferDemo(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.payments.confirmBankTransferDemo(req.user.id, id);
  }
  @Get('orders/:id/bank-qr')
  @UseGuards(AuthGuard)
  bankQr(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.payments.bankQr(req.user.id, id);
  }
  @Post('orders/:id/bank-transfer-demo/fail')
  @UseGuards(AuthGuard)
  failBankTransferDemo(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: unknown) {
    return this.payments.failBankTransferDemo(req.user.id, id, body);
  }
  @Post('orders/:id/retry')
  @UseGuards(AuthGuard)
  retry(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.payments.retry(req.user.id, id);
  }
}
