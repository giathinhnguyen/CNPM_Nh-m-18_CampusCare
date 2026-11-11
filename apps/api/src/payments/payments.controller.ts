import {
  ApiTags,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiQuery,
  ApiOperation,
} from '@nestjs/swagger';
import { ApiRequestBody } from '../swagger/request-bodies.js';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PaymentsService } from './payments.service.js';
import { ZalopayPaymentsService } from './zalopay-payments.service.js';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService, private readonly zalopay: ZalopayPaymentsService) {}
  @Get('config') config() {
    return this.payments.config();
  }
  @ApiOperation({ summary: 'ZaloPay sandbox callback (HMAC-SHA256, no JWT)' })
  @ApiRequestBody('zalopay')
  @Post('zalopay/callback')
  @HttpCode(200)
  zalopayCallback(@Body() body: unknown) {
    return this.zalopay.callback(body);
  }
  @ApiOperation({ summary: 'Verify the signed ZaloPay redirect and return a public receipt' })
  @ApiRequestBody('zalopay')
  @Post('zalopay/result')
  @HttpCode(200)
  zalopayResult(@Body() body: unknown) {
    return this.zalopay.returned(body);
  }
  @Get('orders/:id/zalopay-qr')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  zalopayQr(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.zalopay.qr(req.user.id, id);
  }
  @Get(':id/order')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  order(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.payments.orderForPayment(req.user.id, id);
  }
  @ApiOperation({
    description:
      'Signed VNPay callback. Requires the original vnp_* parameters and a valid vnp_SecureHash.',
  })
  @ApiQuery({ name: 'vnp_TxnRef', required: false, type: String })
  @ApiQuery({ name: 'vnp_Amount', required: false, type: String })
  @ApiQuery({ name: 'vnp_ResponseCode', required: false, type: String })
  @ApiQuery({ name: 'vnp_TransactionStatus', required: false, type: String })
  @ApiQuery({ name: 'vnp_SecureHash', required: false, type: String })
  @Get('vnpay/ipn')
  ipn(@Query() query: Record<string, unknown>) {
    return this.payments.notification(query);
  }
  @ApiRequestBody('vnpay')
  @Post('vnpay/return')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  returned(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.payments.handleReturn(req.user.id, body);
  }
  @ApiRequestBody('vnpay')
  @Post('vnpay/result')
  result(@Body() body: unknown) {
    return this.payments.publicReturn(body);
  }
  @ApiRequestBody('payment')
  @Post()
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.payments.create(req.user.id, body, req.ip ?? '127.0.0.1');
  }
  @Post('orders/:id/reconcile')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  reconcile(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.payments.reconcile(req.user.id, id);
  }
  @Post('orders/:id/cancel')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  cancel(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.payments.cancel(req.user.id, id);
  }
  @Post('orders/:id/bank-transfer-demo/confirm')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  confirmBankTransferDemo(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.payments.confirmBankTransferDemo(req.user.id, id);
  }
  @Get('orders/:id/bank-qr')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  bankQr(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.payments.bankQr(req.user.id, id);
  }
  @ApiRequestBody('bankFailure')
  @Post('orders/:id/bank-transfer-demo/fail')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  failBankTransferDemo(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.payments.failBankTransferDemo(req.user.id, id, body);
  }
  @Post('orders/:id/retry')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  retry(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.payments.retry(req.user.id, id);
  }
}
