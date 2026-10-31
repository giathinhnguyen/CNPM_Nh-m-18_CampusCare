import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import {
  isUuid,
  lockCustomer,
  validateObject,
} from '../rewards/reward-transactions.js';
import { CartsService } from './carts.service.js';

@Injectable()
export class CartQuotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carts: CartsService,
    private readonly promotions: PromotionsService,
  ) {}

  async quote(userId: string, body: unknown) {
    const input = validateObject(body, ['itemIds', 'code']);
    if (
      !Array.isArray(input.itemIds) ||
      !input.itemIds.length ||
      input.itemIds.length > 100 ||
      !input.itemIds.every(isUuid) ||
      (input.code !== undefined &&
        input.code !== null &&
        (typeof input.code !== 'string' ||
          !input.code.trim() ||
          input.code.trim().length > 50))
    ) {
      throw new BadRequestException(
        'Danh sách món hoặc mã ưu đãi không hợp lệ',
      );
    }
    // Preserve the requested order so prices stay aligned with the cart rows.
    const itemIds = input.itemIds.map((id) => id.toLowerCase());
    if (new Set(itemIds).size !== itemIds.length)
      throw new BadRequestException('Không được chọn trùng món');
    const code =
      typeof input.code === 'string' ? input.code.trim().toUpperCase() : null;
    return this.prisma.$transaction(async (tx) => {
      await lockCustomer(tx, userId);
      const cart = await this.carts.getCart(userId, tx);
      const byId = new Map(cart.items.map((item) => [item.id, item]));
      const selected = itemIds.map((id) => {
        const item = byId.get(id);
        if (!item)
          throw new BadRequestException(
            'Món không còn tồn tại hoặc không thuộc giỏ hàng của bạn',
          );
        if (item.isOutOfStock)
          throw new BadRequestException(
            'Món không còn khả dụng hoặc số lượng vượt tồn kho',
          );
        return item;
      });
      const regular = selected.filter((item) => !item.isReward);
      if (!regular.length && code)
        throw new BadRequestException(
          'Mã ưu đãi chỉ áp dụng cho sản phẩm mua thường',
        );
      const zero = new Prisma.Decimal(0);
      const quote = regular.length
        ? await this.promotions.calculateQuote(tx, {
            code,
            items: regular.map((item) => ({
              productSizeId: item.productSizeId,
              quantity: item.quantity,
              toppingIds: item.toppings.map((topping) => topping.id),
            })),
          })
        : {
            promotionId: null,
            promotionCode: null,
            totalAmount: zero,
            discountAmount: zero,
            finalAmount: zero,
            items: [],
          };
      const prices = new Map(
        regular.map((item, index) => [item.id, quote.items[index]]),
      );
      return {
        ...quote,
        items: selected.map((item) => ({
          cartItemId: item.id,
          productSizeId: item.productSizeId,
          unitPrice: prices.get(item.id)?.unitPrice ?? zero,
          totalPrice: prices.get(item.id)?.totalPrice ?? zero,
        })),
      };
    });
  }
}
