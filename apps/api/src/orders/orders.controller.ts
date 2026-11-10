import {
  ApiTags,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiRequestBody } from '../swagger/request-bodies.js';
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

@ApiTags('orders')
@Controller('orders')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @ApiRequestBody('order')
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
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
