import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DrinkLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { AddToCartDto } from './carts.dto.js';
import {
  isUuid,
  lockCustomer,
  releaseRedemption,
} from '../rewards/reward-transactions.js';

@Injectable()
export class CartsService {
  constructor(private prisma: PrismaService) {}

  async getCart(userId: string, database: Prisma.TransactionClient = this.prisma) {
    const items = await database.cartItem.findMany({
      where: { userId },
      include: {
        product: { include: { category: true } },
        productSize: true,
        rewardRedemption: { include: { rewardProduct: true } },
        toppings: { include: { topping: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    const quantities = new Map<string, number>();
    for (const item of items)
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    const formattedItems = items.map((item) => {
      const reward = item.rewardRedemption;
      const unitPrice = reward
        ? 0
        : Number(item.product.basePrice) +
          Number(item.productSize.priceAdjustment) +
          item.toppings.reduce((sum, t) => sum + Number(t.topping.price), 0);
      const isOutOfStock =
        !item.product.isActive ||
        !item.product.category.isActive ||
        !item.productSize.isActive ||
        item.product.stockQuantity < (quantities.get(item.productId) ?? 0) ||
        item.toppings.some((t) => !t.topping.isActive) ||
        Boolean(
          reward &&
          (reward.status !== 'PENDING' || !reward.rewardProduct.isActive),
        );
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
        totalPrice: unitPrice * item.quantity,
        isReward: Boolean(reward),
        rewardPoints: reward?.totalPointsSpent ?? null,
        rewardRedemptionId: item.rewardRedemptionId,
        toppings: item.toppings.map((t) => ({
          id: t.topping.id,
          name: t.topping.name,
          price: Number(t.topping.price),
        })),
        stockQuantity: item.product.stockQuantity,
        isOutOfStock,
      };
    });
    return {
      items: formattedItems,
      totalAmount: formattedItems.reduce(
        (sum, item) =>
          sum + (!item.isOutOfStock && item.isSelected ? item.totalPrice : 0),
        0,
      ),
      totalItems: formattedItems.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  private validate(dto: AddToCartDto) {
    if (
      !dto ||
      !isUuid(dto.productId) ||
      !isUuid(dto.productSizeId) ||
      !Number.isSafeInteger(dto.quantity) ||
      dto.quantity < 1 ||
      (dto.sweetnessLevel !== undefined &&
        !Object.values(DrinkLevel).includes(dto.sweetnessLevel)) ||
      (dto.iceLevel !== undefined &&
        !Object.values(DrinkLevel).includes(dto.iceLevel)) ||
      (dto.note !== undefined &&
        (typeof dto.note !== 'string' || dto.note.length > 255)) ||
      (dto.toppingIds !== undefined &&
        (!Array.isArray(dto.toppingIds) ||
          !dto.toppingIds.every(isUuid) ||
          new Set(dto.toppingIds.map((id) => id.toLowerCase())).size !==
            dto.toppingIds.length))
    ) {
      throw new BadRequestException('Cấu hình món hoặc số lượng không hợp lệ');
    }
  }

  private async add(
    tx: Prisma.TransactionClient,
    userId: string,
    dto: AddToCartDto,
  ) {
    this.validate(dto);
    const { productId, productSizeId, quantity, note } = dto;
    const toppingIds = (dto.toppingIds ?? []).map((id) => id.toLowerCase());
    const size = await tx.productSize.findFirst({
      where: {
        id: productSizeId,
        productId,
        isActive: true,
        product: { isActive: true, category: { isActive: true } },
      },
      include: { product: true },
    });
    if (!size)
      throw new NotFoundException(
        'Sản phẩm hoặc kích thước không còn khả dụng',
      );
    if (
      (await tx.topping.count({
        where: { id: { in: toppingIds }, isActive: true },
      })) !== toppingIds.length
    ) {
      throw new BadRequestException('Topping không còn khả dụng');
    }
    const allItems = await tx.cartItem.findMany({
      where: { userId, productId },
      include: { toppings: true },
    });
    if (
      allItems.reduce((sum, item) => sum + item.quantity, 0) + quantity >
      size.product.stockQuantity
    ) {
      throw new BadRequestException(
        `Hiện số lượng tối đa của món ${size.product.name} là ${size.product.stockQuantity} ly (tính cả các lựa chọn đã có trong giỏ).`,
      );
    }
    const sweetnessLevel = dto.sweetnessLevel ?? 'HUNDRED';
    const iceLevel = dto.iceLevel ?? 'HUNDRED';
    // A regular purchase must never merge into the zero-priced reward row.
    const matched = allItems.find(
      (item) =>
        !item.rewardRedemptionId &&
        item.productSizeId === productSizeId &&
        item.sweetnessLevel === sweetnessLevel &&
        item.iceLevel === iceLevel &&
        (item.note ?? '') === (note ?? '') &&
        JSON.stringify(item.toppings.map((t) => t.toppingId).sort()) ===
          JSON.stringify([...toppingIds].sort()),
    );
    if (matched)
      return tx.cartItem.update({
        where: { id: matched.id },
        data: { quantity: { increment: quantity } },
      });
    return tx.cartItem.create({
      data: {
        userId,
        productId,
        productSizeId,
        sweetnessLevel,
        iceLevel,
        quantity,
        note,
        toppings: { create: toppingIds.map((toppingId) => ({ toppingId })) },
      },
    });
  }

  async addToCart(userId: string, dto: AddToCartDto) {
    return this.prisma.$transaction(async (tx) => {
      await lockCustomer(tx, userId);
      return this.add(tx, userId, dto);
    });
  }

  async updateQuantity(
    userId: string,
    itemId: string,
    quantity?: number,
    note?: string,
    isSelected?: boolean,
  ) {
    if (
      !isUuid(itemId) ||
      (quantity !== undefined &&
        (!Number.isSafeInteger(quantity) || quantity < 0)) ||
      (note !== undefined && (typeof note !== 'string' || note.length > 255)) ||
      (isSelected !== undefined && typeof isSelected !== 'boolean')
    )
      throw new BadRequestException('Dữ liệu cập nhật không hợp lệ');
    if (quantity === 0) return this.removeItem(userId, itemId);
    return this.prisma.$transaction(async (tx) => {
      await lockCustomer(tx, userId);
      const item = await tx.cartItem.findFirst({
        where: { id: itemId, userId },
        include: { product: true },
      });
      if (!item) throw new NotFoundException('Món không tồn tại trong giỏ');
      if (item.rewardRedemptionId && quantity !== undefined && quantity !== 1)
        throw new BadRequestException('Mỗi lượt đổi thưởng chỉ có 1 sản phẩm');
      if (quantity !== undefined && quantity > item.quantity) {
        const total = await tx.cartItem.aggregate({
          where: { userId, productId: item.productId, id: { not: itemId } },
          _sum: { quantity: true },
        });
        if ((total._sum.quantity ?? 0) + quantity > item.product.stockQuantity)
          throw new BadRequestException('Số lượng trong giỏ vượt tồn kho');
      }
      return tx.cartItem.update({
        where: { id: itemId },
        data: { quantity, note, isSelected },
      });
    });
  }

  async removeItem(userId: string, itemId: string) {
    if (!isUuid(itemId)) throw new BadRequestException('Mã món không hợp lệ');
    return this.prisma.$transaction(async (tx) => {
      await lockCustomer(tx, userId);
      const item = await tx.cartItem.findFirst({
        where: { id: itemId, userId },
      });
      if (item?.rewardRedemptionId)
        await releaseRedemption(tx, item.rewardRedemptionId);
      return tx.cartItem.deleteMany({ where: { id: itemId, userId } });
    });
  }

  async syncCart(userId: string, localItems: AddToCartDto[]) {
    if (!Array.isArray(localItems) || localItems.length > 100)
      throw new BadRequestException('Giỏ đồng bộ không hợp lệ');
    const warnings: string[] = [];
    await this.prisma.$transaction(
      async (tx) => {
        await lockCustomer(tx, userId);
        for (const input of localItems) {
          this.validate(input);
          const product = await tx.product.findUnique({
            where: { id: input.productId },
          });
          if (!product?.isActive) continue;
          const existing = await tx.cartItem.aggregate({
            where: { userId, productId: input.productId },
            _sum: { quantity: true },
          });
          const remaining =
            product.stockQuantity - (existing._sum.quantity ?? 0);
          if (input.quantity > remaining)
            warnings.push(
              `Món "${product.name}" đã được giới hạn theo tồn kho ${product.stockQuantity} ly.`,
            );
          if (remaining <= 0) continue;
          await this.add(tx, userId, {
            ...input,
            quantity: Math.min(remaining, input.quantity),
          });
        }
      },
      { timeout: 15000 },
    );
    return { ...(await this.getCart(userId)), warnings };
  }
}
