import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PromotionsService } from './promotions.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';

const sizeId = '10000000-0000-4000-8000-000000000001';
const toppingId = '20000000-0000-4000-8000-000000000001';
const productId = '30000000-0000-4000-8000-000000000001';
const input = {
  code: ' brew10 ',
  items: [{ productSizeId: sizeId, quantity: 1 }],
};

function fixture() {
  const promotion = {
    id: 'promotion',
    code: 'BREW10',
    discountType: 'PERCENTAGE',
    discountValue: new Prisma.Decimal(10),
    minOrderAmount: new Prisma.Decimal(0),
    maxDiscountAmount: null as Prisma.Decimal | null,
    appliesToAllProducts: true,
    products: [] as { productId: string }[],
  };
  const tx = {
    promotion: { findFirst: vi.fn(async () => promotion) },
    productSize: {
      findMany: vi.fn(async () => [
        {
          id: sizeId,
          priceAdjustment: new Prisma.Decimal(1000),
          product: { id: productId, basePrice: new Prisma.Decimal(49005), stockQuantity: 100 },
        },
      ]),
    },
    topping: {
      findMany: vi.fn(async () => [
        { id: toppingId, price: new Prisma.Decimal(10000) },
      ]),
    },
  };
  // Mặc định không chọn topping; mỗi test có thể thay đổi dữ liệu trả về.
  tx.topping.findMany.mockResolvedValue([]);
  const database = {
    $transaction: vi.fn(async (work: (client: unknown) => unknown) => work(tx)),
  } as unknown as PrismaService;
  return { promotion, tx, service: new PromotionsService(database) };
}

describe('PromotionsService - tính giảm giá', () => {
  it('đọc giá server, làm tròn tổng và cho phép tính lại cùng mã', async () => {
    const f = fixture();
    const first = await f.service.quote(input);
    const second = await f.service.quote(input);
    expect(first.totalAmount.toString()).toBe('50005');
    expect(first.discountAmount.toString()).toBe('5001');
    expect(first.finalAmount.toString()).toBe('45004');
    expect(second).toEqual(first);
    expect(f.tx.promotion.findFirst.mock.calls[0]).toBeDefined();
  });

  it('tính cả topping và số lượng trước khi làm tròn một lần', async () => {
    const f = fixture();
    f.tx.topping.findMany.mockResolvedValue([
      { id: toppingId, price: new Prisma.Decimal(10000) },
    ]);
    const result = await f.service.quote({
      code: 'BREW10',
      items: [{ ...input.items[0], quantity: 2, toppingIds: [toppingId] }],
    });
    expect(result.totalAmount.toString()).toBe('120010');
    expect(result.discountAmount.toString()).toBe('12001');
  });

  it('áp mức trần và không cho giảm cố định vượt tiền món', async () => {
    const f = fixture();
    f.promotion.maxDiscountAmount = new Prisma.Decimal(1000);
    expect((await f.service.quote(input)).discountAmount.toString()).toBe(
      '1000',
    );
    f.promotion.discountType = 'FIXED';
    f.promotion.discountValue = new Prisma.Decimal(200000);
    f.promotion.maxDiscountAmount = null;
    expect((await f.service.quote(input)).finalAmount.toString()).toBe('0');
  });

  it('từ chối đơn chưa đủ tối thiểu hoặc không có sản phẩm thuộc phạm vi', async () => {
    const f = fixture();
    f.promotion.minOrderAmount = new Prisma.Decimal(150000);
    await expect(f.service.quote(input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    f.promotion.minOrderAmount = new Prisma.Decimal(0);
    f.promotion.appliesToAllProducts = false;
    await expect(f.service.quote(input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    f.promotion.products = [{ productId }];
    expect((await f.service.quote(input)).discountAmount.toString()).toBe(
      '5001',
    );
  });

  it('từ chối mã không hợp lệ hoặc món không khả dụng', async () => {
    const f = fixture();
    f.tx.promotion.findFirst.mockResolvedValueOnce(null as never);
    await expect(f.service.quote(input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    f.tx.productSize.findMany.mockResolvedValueOnce([]);
    await expect(f.service.quote(input)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it.each([
    null,
    {},
    { ...input, code: ['BREW10', 'MOOD20K'] },
    { ...input, codes: ['BREW10'] },
    { ...input, totalAmount: 1 },
    { ...input, items: [] },
    ...[0, -1, 1.5, '2', Number.MAX_SAFE_INTEGER + 1].map((quantity) => ({
      ...input,
      items: [{ productSizeId: sizeId, quantity }],
    })),
    { ...input, items: [{ ...input.items[0], productSizeId: 'invalid' }] },
    { ...input, items: [{ ...input.items[0], unitPrice: 1 }] },
    { ...input, items: [{ ...input.items[0], toppingIds: null }] },
    {
      ...input,
      items: [
        { ...input.items[0], toppingIds: [toppingId, toppingId.toUpperCase()] },
      ],
    },
  ])('từ chối request không hợp lệ %#', async (invalid) => {
    const f = fixture();
    await expect(f.service.quote(invalid)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(f.tx.promotion.findFirst).not.toHaveBeenCalled();
  });
});
