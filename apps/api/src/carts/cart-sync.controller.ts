import { Body, Controller, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { CartSyncService } from './cart-sync.service.js';
import { CartSyncDto } from './dto/cart-sync.dto.js';

@Controller('cart')
@UseGuards(AuthGuard)
export class CartSyncController {
  constructor(private readonly cartSyncService: CartSyncService) {}

  @Post('sync-once')
  @HttpCode(200)
  syncCart(@Req() req: AuthenticatedRequest, @Body() dto: CartSyncDto) {
    return this.cartSyncService.syncCart(req.user.id, dto);
  }
}
