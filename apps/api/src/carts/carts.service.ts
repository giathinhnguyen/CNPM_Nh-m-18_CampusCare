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

        // Tính tổng số lượng hiện tại của sản phẩm này trong giỏ (tính cả các tùy chọn khác)
        const allItemsForProduct = await this.prisma.cartItem.findMany({
            where: { userId, productId },
        });
        const currentTotal = allItemsForProduct.reduce((sum, item) => sum + item.quantity, 0);

        if (currentTotal + quantity > product.stockQuantity) {
            throw new BadRequestException(
                `Hiện số lượng tối đa của món ${product.name} là ${product.stockQuantity} ly (tính cả các lựa chọn đã có trong giỏ).`
            );
        }

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

    // 3. CẬP NHẬT SỐ LƯỢNG (+ / -) HOẶC GHI CHÚ / TRẠNG THÁI CHỌN
    async updateQuantity(userId: string, itemId: string, quantity?: number, note?: string, isSelected?: boolean) {
        if (quantity !== undefined && quantity <= 0) {
            return this.removeItem(userId, itemId);
        }

        const item = await this.prisma.cartItem.findFirst({
            where: { id: itemId, userId },
            include: { product: true },
        });
        if (!item) throw new NotFoundException('Món không tồn tại trong giỏ');

        if (quantity !== undefined && quantity > item.quantity) {
            const allItemsForProduct = await this.prisma.cartItem.findMany({
                where: { userId, productId: item.productId },
            });
            const otherItemsTotal = allItemsForProduct
                .filter((i) => i.id !== itemId)
                .reduce((sum, i) => sum + i.quantity, 0);

            if (otherItemsTotal + quantity > item.product.stockQuantity) {
                throw new BadRequestException(
                    `Hiện số lượng tối đa của món ${item.product.name} là ${item.product.stockQuantity} ly (tính cả các lựa chọn đã có trong giỏ).`
                );
            }
        }

        const data: any = {};
        if (quantity !== undefined) data.quantity = quantity;
        if (note !== undefined) data.note = note;
        if (isSelected !== undefined) data.isSelected = isSelected;

        return this.prisma.cartItem.update({
            where: { id: itemId },
            data,
        });
    }

    // 4. XÓA MÓN
    async removeItem(userId: string, itemId: string) {
        return this.prisma.cartItem.deleteMany({
            where: { id: itemId, userId },
        });
    }

    // 5. ĐỒNG BỘ GIỎ HÀNG KHI ĐĂNG NHẬP — Giới hạn số lượng về tối đa khi vượt tồn kho
    async syncCart(userId: string, localItems: AddToCartDto[]) {
        if (!localItems || localItems.length === 0) return this.getCart(userId);

        const warnings: string[] = [];

        for (const item of localItems) {
            const { productId, productSizeId, sweetnessLevel, iceLevel, toppingIds = [], note } = item;
            let quantity = item.quantity;

            // Lấy thông tin sản phẩm để kiểm tra tồn kho
            const product = await this.prisma.product.findUnique({ where: { id: productId } });

            // Bỏ qua nếu sản phẩm không còn tồn tại hoặc không còn hoạt động
            if (!product || !product.isActive) continue;

            // Tổng số lượng đã có trong giỏ của user (theo tất cả tùy chọn khác nhau)
            const allItemsInCart = await this.prisma.cartItem.findMany({
                where: { userId, productId },
            });
            const currentTotal = allItemsInCart.reduce((sum, i) => sum + i.quantity, 0);

            const remaining = product.stockQuantity - currentTotal;

            if (remaining <= 0) {
                // Giỏ hàng đã đạt tối đa — bỏ qua món này
                warnings.push(
                    `Món "${product.name}" đã đạt số lượng tối đa (${product.stockQuantity} ly). Không thể thêm từ giỏ khách vãng lai.`,
                );
                continue;
            }

            if (quantity > remaining) {
                // Cắt số lượng về mức còn được phép
                warnings.push(
                    `Món "${product.name}" đã được điều chỉnh còn ${remaining} ly (giỏ hàng đã có ${currentTotal} ly, tối đa ${product.stockQuantity} ly).`,
                );
                quantity = remaining;
            }

            // Tìm món trùng thuộc tính trong giỏ để cộng dồn
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

            const matchedItem = existingItems.find((existingItem) => {
                const existingToppingIds = existingItem.toppings.map((t) => t.toppingId).sort();
                const newToppingIds = [...toppingIds].sort();
                return JSON.stringify(existingToppingIds) === JSON.stringify(newToppingIds);
            });

            if (matchedItem) {
                await this.prisma.cartItem.update({
                    where: { id: matchedItem.id },
                    data: { quantity: matchedItem.quantity + quantity },
                });
            } else {
                await this.prisma.cartItem.create({
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
        }

        const cart = await this.getCart(userId);

        // Trả kèm danh sách cảnh báo để frontend hiển thị thông báo
        return { ...cart, warnings };
    }
}