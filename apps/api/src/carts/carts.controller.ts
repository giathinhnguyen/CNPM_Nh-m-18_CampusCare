import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { CartsService } from './carts.service.js';
import { AddToCartDto, UpdateQuantityDto } from './carts.dto.js';

@Controller('cart')
@UseGuards(AuthGuard)
export class CartsController {
    constructor(private readonly cartsService: CartsService) { }

    @Get()
    async getCart(@Req() req: AuthenticatedRequest) {
        const userId = (req as any).user?.id || req.user.id;
        return this.cartsService.getCart(userId);
    }

    @Post('items')
    async addToCart(@Req() req: AuthenticatedRequest, @Body() dto: AddToCartDto) {
        const userId = (req as any).user?.id || req.user.id;
        return this.cartsService.addToCart(userId, dto);
    }

    @Patch('items/:id')
    async updateQuantity(
        @Req() req: AuthenticatedRequest, // Đã bổ sung dòng này bị thiếu lúc trước
        @Param('id') id: string,
        @Body() dto: UpdateQuantityDto
    ) {
        const userId = (req as any).user?.id || req.user.id;
        return this.cartsService.updateQuantity(userId, id, dto.quantity);
    }

    @Delete('items/:id')
    async removeItem(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
        const userId = (req as any).user?.id || req.user.id;
        return this.cartsService.removeItem(userId, id);
    }

    @Post('sync')
    async syncCart(@Req() req: AuthenticatedRequest, @Body('items') items: AddToCartDto[]) {
        const userId = (req as any).user?.id || req.user.id;
        return this.cartsService.syncCart(userId, items);
    }
}