import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddToCartDto } from './carts.dto.js';

@Injectable()
export class CartsService {
    constructor(private prisma: PrismaService) { }

    // 1. LẤY GIỎ HÀNG: Kiểm tra TỒN KHO và TÍNH TIỀN
    async getCart(userId: string) {
        const items = await this.prisma.cartItem.findMany({
            where: { userId },
            include: {
                product: true,
                productSize: true,
                toppings: {
                    include: { topping: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        let totalAmount = 0;

        const formattedItems = items.map((item) => {
            const basePrice = Number(item.product.basePrice);
            const sizePrice = Number(item.productSize.priceAdjustment);
            const toppingsPrice = item.toppings.reduce(
                (sum, t) => sum + Number(t.topping.price),
                0
            );
            const unitPrice = basePrice + sizePrice + toppingsPrice;
            const itemTotalPrice = unitPrice * item.quantity;

            // KIỂM TRA TỒN KHO
            const isOutOfStock =
                !item.product.isActive ||
                !item.productSize.isActive ||
                item.product.stockQuantity <= 0;

            // Chỉ cộng tiền nếu món còn hàng và đang được tick chọn
            if (!isOutOfStock && item.isSelected) {
                totalAmount += itemTotalPrice;
            }

            return {
                id: item.id,
                productId: item.productId,
                productName: item.product.name,
                imageUrl: item.product.imageUrl,
                size: item.productSize.size,
                productSizeId: item.productSizeId,
                sweetnessLevel: item.sweetnessLevel,
                iceLevel: item.iceLevel,
                quantity: item.quantity,
                note: item.note,
                isSelected: item.isSelected,
                unitPrice,
                totalPrice: itemTotalPrice,
                toppings: item.toppings.map((t) => ({
                    id: t.topping.id,
                    name: t.topping.name,
                    price: Number(t.topping.price),
                })),
                stockQuantity: item.product.stockQuantity,
                isOutOfStock, // Cờ báo cho Frontend
            };
        });

        return {
            items: formattedItems,
            totalAmount,
            totalItems: formattedItems.reduce((sum, i) => sum + i.quantity, 0),
        };
    }

    // 2. THÊM MÓN VÀO GIỎ: Tự cộng dồn nếu trùng thuộc tính
    async addToCart(userId: string, dto: AddToCartDto) {
        const { productId, productSizeId, sweetnessLevel, iceLevel, quantity, toppingIds = [], note } = dto;

        const product = await this.prisma.product.findUnique({ where: { id: productId } });
        if (!product || !product.isActive) throw new NotFoundException('Sản phẩm không tồn tại');
        if (product.stockQuantity < quantity) throw new BadRequestException('Số lượng tồn kho không đủ');

        // Tìm món cùng loại trong giỏ của user
        const existingItems = await this.prisma.cartItem.findMany({
            where: {
                userId,
                productId,
                productSizeId,
                sweetnessLevel: sweetnessLevel || 'HUNDRED',
                iceLevel: iceLevel || 'HUNDRED',
            },
            include: { toppings: true },
        });

        const matchedItem = existingItems.find((item) => {
            const existingToppingIds = item.toppings.map((t) => t.toppingId).sort();
            const newToppingIds = [...toppingIds].sort();
            return JSON.stringify(existingToppingIds) === JSON.stringify(newToppingIds);
        });

        if (matchedItem) {
            return this.prisma.cartItem.update({
                where: { id: matchedItem.id },
                data: { quantity: matchedItem.quantity + quantity },
            });
        }

        return this.prisma.cartItem.create({
            data: {
                userId,
                productId,
                productSizeId,
                sweetnessLevel: sweetnessLevel || 'HUNDRED',
                iceLevel: iceLevel || 'HUNDRED',
                quantity,
                note,
                toppings: {
                    create: toppingIds.map((toppingId) => ({
                        topping: { connect: { id: toppingId } },
                    })),
                },
            },
        });
    }

    // 3. CẬP NHẬT SỐ LƯỢNG (+ / -)
    async updateQuantity(userId: string, itemId: string, quantity: number) {
        if (quantity <= 0) {
            return this.removeItem(userId, itemId);
        }

        const item = await this.prisma.cartItem.findFirst({
            where: { id: itemId, userId },
            include: { product: true },
        });
        if (!item) throw new NotFoundException('Món không tồn tại trong giỏ');
        if (item.product.stockQuantity < quantity) {
            throw new BadRequestException(`Chỉ còn ${item.product.stockQuantity} sản phẩm trong kho`);
        }

        return this.prisma.cartItem.update({
            where: { id: itemId },
            data: { quantity },
        });
    }

    // 4. XÓA MÓN
    async removeItem(userId: string, itemId: string) {
        return this.prisma.cartItem.deleteMany({
            where: { id: itemId, userId },
        });
    }

    // 5. ĐỒNG BỘ GIỎ HÀNG KHI ĐĂNG NHẬP
    async syncCart(userId: string, localItems: AddToCartDto[]) {
        if (!localItems || localItems.length === 0) return this.getCart(userId);

        for (const item of localItems) {
            await this.addToCart(userId, item);
        }
        return this.getCart(userId);
    }
}