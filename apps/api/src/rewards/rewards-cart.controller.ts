import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import type { AddToCartDto, UpdateQuantityDto } from '../carts/carts.dto.js';
import { RewardsCartService } from './rewards-cart.service.js';
import { validateObject } from './reward-transactions.js';

@Controller('rewards/cart')
@UseGuards(AuthGuard)
export class RewardsCartController {
  constructor(private readonly cart: RewardsCartService) {}

  @Get()
  getCart(@Req() req: AuthenticatedRequest) {
    return this.cart.getCart(req.user.id);
  }

  @Post('quote')
  @HttpCode(200)
  quote(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.cart.quote(req.user.id, body);
  }

  @Post('items')
  addItem(@Req() req: AuthenticatedRequest, @Body() body: AddToCartDto) {
    return this.cart.addToCart(req.user.id, body);
  }

  @Patch('items/:id')
  updateItem(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const input = validateObject(body, [
      'quantity',
      'note',
      'isSelected',
    ]) as UpdateQuantityDto;
    return this.cart.updateQuantity(
      req.user.id,
      id,
      input.quantity,
      input.note,
      input.isSelected,
    );
  }

  @Delete('items/:id')
  removeItem(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.cart.removeItem(req.user.id, id);
  }

  @Post('sync')
  @HttpCode(200)
  syncCart(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.cart.syncCart(req.user.id, body);
  }
}
