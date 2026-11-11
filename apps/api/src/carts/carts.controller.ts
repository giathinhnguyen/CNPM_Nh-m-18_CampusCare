import {
  ApiTags,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiRequestBody } from '../swagger/request-bodies.js';
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { randomUUID } from 'node:crypto';
import type { AddToCartDto, UpdateQuantityDto } from './carts.dto.js';
import { RewardsCartService } from '../rewards/rewards-cart.service.js';
import { validateObject } from '../rewards/reward-transactions.js';

@ApiTags('cart')
@Controller('cart')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
@UseGuards(AuthGuard)
export class CartsController {
  // Both API prefixes must enforce the same inventory and reward rules.
  constructor(private readonly cartsService: RewardsCartService) {}

  @ApiRequestBody('cartQuote')
  @Post('quote')
  quote(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.cartsService.quote(req.user.id, body);
  }

  @Get()
  async getCart(@Req() req: AuthenticatedRequest) {
    const userId = (req as any).user?.id || req.user.id;
    return this.cartsService.getCart(userId);
  }

  @ApiRequestBody('cartItem')
  @Post('items')
  async addToCart(@Req() req: AuthenticatedRequest, @Body() dto: AddToCartDto) {
    const userId = (req as any).user?.id || req.user.id;
    return this.cartsService.addToCart(userId, dto);
  }

  @ApiRequestBody('updateCart')
  @Patch('items/:id')
  async updateQuantity(
    @Req() req: AuthenticatedRequest, // Đã bổ sung dòng này bị thiếu lúc trước
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = validateObject(body, [
      'quantity',
      'note',
      'isSelected',
    ]) as UpdateQuantityDto;
    const userId = (req as any).user?.id || req.user.id;
    return this.cartsService.updateQuantity(
      userId,
      id,
      dto.quantity,
      dto.note,
      dto.isSelected,
    );
  }

  @Delete('items/:id')
  async removeItem(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = (req as any).user?.id || req.user.id;
    return this.cartsService.removeItem(userId, id);
  }

  @ApiRequestBody('cartSync')
  @Post('sync')
  async syncCart(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const userId = (req as any).user?.id || req.user.id;
    const input = validateObject(body, ['syncId', 'items']);
    // Old clients only send items. Clients that retry can supply a stable syncId.
    return this.cartsService.syncCart(userId, {
      syncId: input.syncId === undefined ? randomUUID() : input.syncId,
      items: input.items,
    });
  }
}
