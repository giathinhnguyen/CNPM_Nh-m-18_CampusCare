import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { BadRequestException } from '@nestjs/common';
import { DrinkSize, PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { CartsService } from '../src/carts/carts.service.js';
import { PromotionsService } from '../src/promotions/promotions.service.js';
import { CartSyncService } from '../src/promotions/cart-sync.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

describe('Giỏ hàng và khuyến mãi với PostgreSQL', () => {
  it('kiểm tra cấu hình món, lưu lựa chọn, tính lại mã và chống gộp trùng khi retry', async () => {
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
          const other = await tx.product.create({
            data: {
              categoryId: category.id,
              name: `${prefix}-OTHER`,
              basePrice: 100000,
              stockQuantity: 10,
            },
          });
          const size = await tx.productSize.create({
            data: { productId: product.id, size: DrinkSize.S },
          });
          const otherSize = await tx.productSize.create({
            data: { productId: other.id, size: DrinkSize.S },
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
          const sync = new CartSyncService(database);
          const promos = new PromotionsService(database);
          const input = {
            productId: product.id,
            productSizeId: size.id,
            quantity: 2,
          };

          const wrongSize = await sync.syncCart(user.id, {
            syncId: randomUUID(), items: [{ ...input, productSizeId: otherSize.id }],
          });
          expect(wrongSize.warnings).toHaveLength(1);
          expect(wrongSize.items).toHaveLength(0);
          await expect(
            sync.syncCart(user.id, { syncId: randomUUID(), items: [{ ...input, quantity: -1 }] }),
          ).rejects.toBeInstanceOf(BadRequestException);
          await tx.topping.update({
            where: { id: topping.id },
            data: { isActive: false },
          });
          const inactiveTopping = await sync.syncCart(user.id, {
            syncId: randomUUID(), items: [{ ...input, toppingIds: [topping.id] }],
          });
          expect(inactiveTopping.warnings).toHaveLength(1);
          expect(inactiveTopping.items).toHaveLength(0);
          await tx.topping.update({
            where: { id: topping.id },
            data: { isActive: true },
          });

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

          const syncId = randomUUID();
          await sync.syncCart(user.id, { items: [{ ...input, quantity: 1 }], syncId });
          await sync.syncCart(user.id, { items: [{ ...input, quantity: 1 }], syncId });
          cart = await carts.getCart(user.id);
          expect(cart.items[0].quantity).toBe(3);
          expect(await tx.cartSync.count({ where: { userId: user.id, syncId } })).toBe(
            1,
          );
          await expect(
            sync.syncCart(user.id, { items: [{ ...input, quantity: 2 }], syncId }),
          ).rejects.toBeInstanceOf(BadRequestException);

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

          const before = await tx.cartItem.count({
            where: { userId: user.id },
          });
          await expect(
            sync.syncCart(user.id, { items: [input, { ...input, quantity: 0 }], syncId: randomUUID() }),
          ).rejects.toBeInstanceOf(BadRequestException);
          expect(await tx.cartItem.count({ where: { userId: user.id } })).toBe(
            before,
          );
          await carts.updateQuantity(user.id, rowId, 1);
          expect((await carts.getCart(user.id)).totalAmount).toBe(50000);
          await tx.category.update({
            where: { id: category.id },
            data: { isActive: false },
          });
          const hiddenCategory = await sync.syncCart(user.id, { syncId: randomUUID(), items: [input] });
          expect(hiddenCategory.warnings).toHaveLength(1);
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
