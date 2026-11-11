import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { RefundsService } from './refunds.service.js';

@ApiTags('refunds')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('payments/orders')
export class RefundsController {
  constructor(private readonly refunds: RefundsService) {}
  @Post(':id/refund')
  @ApiOperation({
    summary:
      'Customer owner or administrator: cancel and fully refund within 2 minutes of paidAt',
    description:
      'The server selects GATEWAY or SIMULATION from VNPAY_REFUND_MODE or ZALOPAY_REFUND_MODE, falling back to REFUND_MODE, and persists it. SIMULATION does not send a bank refund. Existing requests retain their original mode.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: { reason: { type: 'string', maxLength: 100 } },
    },
  })
  request(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.refunds.request(req.user.id, id, body);
  }
  @Post(':id/refund/reconcile')
  @ApiOperation({
    summary:
      'Query an already accepted refund, including after the 2-minute request window',
  })
  reconcile(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.refunds.reconcile(req.user.id, id);
  }
}
