import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { OrdersService } from './orders.service.js';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Post() create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.orders.create(req.user.id, body);
  }
  @Get() list(@Req() req: AuthenticatedRequest) {
    return this.orders.list(req.user.id);
  }
  @Get(':id') detail(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.orders.owned(req.user.id, id);
  }
  @Post(':id/cancel') cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.orders.cancel(req.user.id, id);
  }
}
