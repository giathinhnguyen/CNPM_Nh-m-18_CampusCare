import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { DrinkSize, PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { CartsService } from '../src/carts/carts.service.js';
import { PromotionsService } from '../src/promotions/promotions.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

describe('Giỏ hàng và khuyến mãi với PostgreSQL', () => {
  it('gộp bằng service giỏ gốc, lưu lựa chọn và tính lại mã theo giỏ', async () => {
    const prisma = new PrismaClient();
    const rollback = new Error('Rollback dữ liệu kiểm thử');
    const prefix = randomUUID().slice(0, 8).toUpperCase();
    try {
      await prisma.$transaction(
        async (tx) => {
          const user = await tx.user.create({
            data: {
              email: `${prefix}@cart.test`,
              fullName: 'Cart test',
              googleId: `cart-test-${prefix}`,
            },
          });
          const category = await tx.category.create({
            data: { name: prefix, slug: prefix },
          });
          const product = await tx.product.create({
            data: {
              categoryId: category.id,
              name: prefix,
              basePrice: 50000,
              stockQuantity: 10,
            },
          });
          const size = await tx.productSize.create({
            data: { productId: product.id, size: DrinkSize.S },
          });
          const topping = await tx.topping.create({
            data: { name: prefix, price: 10000 },
          });
          const promotion = await tx.promotion.create({
            data: {
              code: prefix,
              discountType: 'PERCENTAGE',
              discountValue: 15,
              minOrderAmount: 150000,
              maxDiscountAmount: 40000,
            },
          });
          const database = {
            ...tx,
            $transaction: async (work: (client: typeof tx) => unknown) =>
              work(tx),
          } as unknown as PrismaService;
          const carts = new CartsService(database);
          const promos = new PromotionsService(database);
          const input = {
            productId: product.id,
            productSizeId: size.id,
            quantity: 2,
          };

          await carts.addToCart(user.id, input);
          let cart = await carts.getCart(user.id);
          const rowId = cart.items[0].id;
          expect(cart.totalAmount).toBe(100000);
          await carts.updateQuantity(user.id, rowId, undefined, undefined, false);
          cart = await carts.getCart(user.id);
          expect(cart.items[0].isSelected).toBe(false);
          expect(cart.totalAmount).toBe(0);
          await expect(
            carts.updateQuantity(user.id, randomUUID(), undefined, undefined, true),
          ).rejects.toThrow('Món không tồn tại trong giỏ');
          await carts.updateQuantity(user.id, rowId, undefined, undefined, true);
          expect((await carts.getCart(user.id)).totalAmount).toBe(100000);

          await carts.syncCart(user.id, [{ ...input, quantity: 1 }]);
          cart = await carts.getCart(user.id);
          expect(cart.items[0].quantity).toBe(3);

          const request = {
            code: prefix,
            items: [{ productSizeId: size.id, quantity: 3 }],
          };
          const valid = await promos.calculateQuote(tx, request);
          expect(valid.discountAmount.toString()).toBe('22500');
          expect(valid.finalAmount.toString()).toBe('127500');
          await expect(
            promos.calculateQuote(tx, {
              ...request,
              items: [{ productSizeId: size.id, quantity: 2 }],
            }),
          ).rejects.toBeInstanceOf(BadRequestException);
          const withoutCode = await promos.calculateQuote(tx, {
            items: [
              { productSizeId: size.id, quantity: 2, toppingIds: [topping.id] },
            ],
          });
          expect(withoutCode.promotionCode).toBeNull();
          expect(withoutCode.discountAmount.toString()).toBe('0');
          expect(withoutCode.totalAmount.toString()).toBe('120000');
          await tx.promotion.update({
            where: { id: promotion.id },
            data: { isActive: false },
          });
          await expect(promos.calculateQuote(tx, request)).rejects.toThrow(
            'không còn hiệu lực',
          );
          await expect(
            promos.calculateQuote(tx, {
              items: [
                { productSizeId: size.id, quantity: 6 },
                { productSizeId: size.id, quantity: 5 },
              ],
            }),
          ).rejects.toBeInstanceOf(BadRequestException);

          await carts.updateQuantity(user.id, rowId, 1);
          expect((await carts.getCart(user.id)).totalAmount).toBe(50000);
          await tx.category.update({
            where: { id: category.id },
            data: { isActive: false },
          });
          await expect(promos.calculateQuote(tx, { items: [{ productSizeId: size.id, quantity: 1 }] })).rejects.toBeInstanceOf(BadRequestException);
          throw rollback;
        },
        { timeout: 20000 },
      );
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await prisma.$disconnect();
    }
  }, 25000);
});
