import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiscountType, DrinkSize, Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { PromotionsService } from '../src/promotions/promotions.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

describe('Khuyến mãi với PostgreSQL', () => {
  it('kiểm tra phạm vi, giá database, hiệu lực, mức trần, làm tròn và dữ liệu đầu vào', async () => {
    const prisma = new PrismaClient();
    const rollback = new Error('Rollback dữ liệu thử');
    const prefix = `TEST-${randomUUID().slice(0, 8)}`.toUpperCase();

    try {
      await prisma.$transaction(
        async (tx) => {
          const category = await tx.category.create({
            data: { name: prefix, slug: prefix },
          });
          const product = await tx.product.create({
            data: { categoryId: category.id, name: prefix, basePrice: 50005, stockQuantity: 100 },
          });
          const other = await tx.product.create({
            data: {
              categoryId: category.id,
              name: `${prefix}-other`,
              basePrice: 100000,
              stockQuantity: 100,
            },
          });
          const size = await tx.productSize.create({
            data: {
              productId: product.id,
              size: DrinkSize.S,
              priceAdjustment: 0,
            },
          });
          const otherSize = await tx.productSize.create({
            data: {
              productId: other.id,
              size: DrinkSize.S,
              priceAdjustment: 0,
            },
          });
          const topping = await tx.topping.create({
            data: { name: prefix, price: 10000 },
          });
          const promotion = await tx.promotion.create({
            data: {
              code: prefix,
              title: 'Ưu đãi thử',
              description: 'Nội dung thử',
              discountType: DiscountType.PERCENTAGE,
              discountValue: 10,
            },
          });
          const service = new PromotionsService(tx as unknown as PrismaService);
          const item = { productSizeId: size.id, quantity: 1 };
          const input = { code: `  ${prefix.toLowerCase()}  `, items: [item] };
          const quote = () => service.calculateQuote(tx, input);

          expect((await quote()).discountAmount.toString()).toBe('5001');
          expect((await quote()).discountAmount.toString()).toBe('5001');
          const withTopping = await service.calculateQuote(tx, {
            code: prefix,
            items: [{ ...item, quantity: 2, toppingIds: [topping.id] }],
          });
          expect(withTopping.totalAmount.toString()).toBe('120010');
          expect(withTopping.discountAmount.toString()).toBe('12001');
          expect(withTopping.finalAmount.toString()).toBe('108009');

          await tx.promotion.update({
            where: { id: promotion.id },
            data: { maxDiscountAmount: 3000 },
          });
          expect((await quote()).discountAmount.toString()).toBe('3000');
          await tx.promotion.update({
            where: { id: promotion.id },
            data: {
              discountType: DiscountType.FIXED,
              discountValue: 200000,
              maxDiscountAmount: null,
              appliesToAllProducts: false,
              minOrderAmount: 150000,
              products: { create: { productId: product.id } },
            },
          });
          const mixed = await service.calculateQuote(tx, {
            code: prefix,
            items: [item, { productSizeId: otherSize.id, quantity: 1 }],
          });
          expect(mixed.totalAmount.toString()).toBe('150005');
          expect(mixed.eligibleAmount.toString()).toBe('50005');
          expect(mixed.discountAmount.toString()).toBe('50005');
          expect(mixed.finalAmount.toString()).toBe('100000');
          await expect(quote()).rejects.toBeInstanceOf(BadRequestException);
          await tx.promotion.update({
            where: { id: promotion.id },
            data: { minOrderAmount: 0 },
          });
          await expect(
            service.calculateQuote(tx, {
              code: prefix,
              items: [{ productSizeId: otherSize.id, quantity: 1 }],
            }),
          ).rejects.toBeInstanceOf(BadRequestException);

          for (const data of [
            { isActive: false, startDate: null, endDate: null },
            {
              isActive: true,
              startDate: new Date('2099-01-01'),
              endDate: null,
            },
            {
              isActive: true,
              startDate: null,
              endDate: new Date('2000-01-01'),
            },
          ]) {
            await tx.promotion.update({ where: { id: promotion.id }, data });
            await expect(quote()).rejects.toBeInstanceOf(NotFoundException);
            expect(
              (await service.findAll()).some(
                (entry) => entry.id === promotion.id,
              ),
            ).toBe(false);
          }
          await tx.promotion.update({
            where: { id: promotion.id },
            data: { startDate: null, endDate: null },
          });
          expect(
            (await service.findAll()).find(
              (entry) => entry.id === promotion.id,
            ),
          ).toMatchObject({
            title: 'Ưu đãi thử',
            description: 'Nội dung thử',
            endDate: null,
            appliesToAllProducts: false,
            products: [{ product: { id: product.id } }],
          });

          const invalidInputs = [
            null,
            {},
            { ...input, code: [prefix, 'OTHER'] },
            { ...input, codes: [prefix] },
            { ...input, totalAmount: 1 },
            { ...input, items: [] },
            ...[0, -1, 1.5, '2', Number.MAX_SAFE_INTEGER + 1].map(
              (quantity) => ({ ...input, items: [{ ...item, quantity }] }),
            ),
            { ...input, items: [{ ...item, productSizeId: 'invalid' }] },
            { ...input, items: [{ ...item, unitPrice: 1 }] },
            {
              ...input,
              items: [
                { ...item, toppingIds: [topping.id, topping.id.toUpperCase()] },
              ],
            },
          ];
          for (const invalid of invalidInputs) {
            await expect(
              service.calculateQuote(tx, invalid),
            ).rejects.toBeInstanceOf(BadRequestException);
          }
          await tx.topping.update({
            where: { id: topping.id },
            data: { isActive: false },
          });
          await expect(
            service.calculateQuote(tx, {
              code: prefix,
              items: [{ ...item, toppingIds: [topping.id] }],
            }),
          ).rejects.toBeInstanceOf(BadRequestException);
          await tx.product.update({
            where: { id: product.id },
            data: { isActive: false },
          });
          await expect(quote()).rejects.toBeInstanceOf(BadRequestException);
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
