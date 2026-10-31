import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { RewardsService } from '../src/rewards/rewards.service.js';
import { CartsService } from '../src/carts/carts.service.js';
import { CartQuotesService } from '../src/carts/cart-quotes.service.js';
import { PromotionsService } from '../src/promotions/promotions.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

describe('Đổi thưởng: transaction PostgreSQL và yêu cầu đồng thời', () => {
  const prisma = new PrismaClient();
  const database = prisma as PrismaService;
  const rewards = new RewardsService(database);
  const carts = new CartsService(database);
  const cartQuotes = new CartQuotesService(
    database,
    carts,
    new PromotionsService(database),
  );
  const userIds: string[] = [];
  const categoryIds: string[] = [];
  afterAll(async () => {
    const orderIds = (
      await prisma.order.findMany({
        where: { userId: { in: userIds } },
        select: { id: true },
      })
    ).map((order) => order.id);
    await prisma.cartItem.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.loyaltyTransaction.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.rewardRedemption.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.order.deleteMany({ where: { id: { in: orderIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.rewardProduct.deleteMany({
      where: { productSize: { product: { categoryId: { in: categoryIds } } } },
    });
    await prisma.product.deleteMany({
      where: { categoryId: { in: categoryIds } },
    });
    await prisma.category.deleteMany({ where: { id: { in: categoryIds } } });
    await prisma.$disconnect();
  });
  async function customer(
    points = 500,
    role: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER',
  ) {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@rewards-test.invalid`,
        googleId: `fixture-${randomUUID()}`,
        fullName: 'Rewards fixture',
        loyaltyPoints: points,
        role,
      },
    });
    userIds.push(user.id);
    return user;
  }
  async function fixture(cost = 120, stock = 10) {
    const user = await customer();
    const unique = randomUUID();
    const category = await prisma.category.create({
      data: { name: unique, slug: unique },
    });
    categoryIds.push(category.id);
    const product = await prisma.product.create({
      data: {
        name: 'Rewards test',
        categoryId: category.id,
        basePrice: 50000,
        stockQuantity: stock,
      },
    });
    const size = await prisma.productSize.create({
      data: { productId: product.id, size: 'S' },
    });
    const reward = await prisma.rewardProduct.create({
      data: { productSizeId: size.id, pointsRequired: cost },
    });
    return { user, category, product, size, reward };
  }
  const redeem = (
    f: Awaited<ReturnType<typeof fixture>>,
    key = randomUUID(),
    userId = f.user.id,
  ) =>
    rewards.redeem(userId, {
      rewardProductId: f.reward.id,
      idempotencyKey: key,
    });
  it('giữ điểm, cấu hình mặc định giá 0đ; xóa món giải phóng đúng một lần', async () => {
    const f = await fixture();
    const result = await redeem(f);
    expect(await rewards.getBalance(f.user.id)).toMatchObject({
      pointsBalance: 500,
      reservedPoints: 120,
      availablePoints: 380,
      hasRewardInCart: true,
    });
    expect((await carts.getCart(f.user.id)).items[0]).toMatchObject({
      unitPrice: 0,
      totalPrice: 0,
      quantity: 1,
      sweetnessLevel: 'HUNDRED',
      iceLevel: 'HUNDRED',
      toppings: [],
      isReward: true,
    });
    await Promise.all(
      Array.from({ length: 4 }, () =>
        carts.removeItem(f.user.id, result.cartItem!.id),
      ),
    );
    expect(await rewards.getBalance(f.user.id)).toMatchObject({
      pointsBalance: 500,
      reservedPoints: 0,
      availablePoints: 500,
      hasRewardInCart: false,
    });
  });
  it('12 yêu cầu khác mã đồng thời chỉ giữ điểm và thêm một món', async () => {
    const f = await fixture();
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () => redeem(f)),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      await prisma.rewardRedemption.count({ where: { userId: f.user.id } }),
    ).toBe(1);
    expect((await rewards.getBalance(f.user.id)).reservedPoints).toBe(120);
  });
  it('8 retry cùng mã yêu cầu không tạo lại; retry sau xóa không giữ điểm lại', async () => {
    const f = await fixture();
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 8 }, () => redeem(f, key)),
    );
    expect(new Set(results.map((result) => result.redemptionId)).size).toBe(1);
    await carts.removeItem(f.user.id, results[0].cartItem!.id);
    expect(await redeem(f, key)).toMatchObject({
      status: 'CANCELLED',
      cartItem: null,
    });
    expect((await rewards.getBalance(f.user.id)).reservedPoints).toBe(0);
  });
  it('không đủ điểm, payload giả và đổi số lượng món thưởng đều bị chặn', async () => {
    const f = await fixture(600);
    await expect(redeem(f)).rejects.toThrow('Điểm khả dụng không đủ');
    await expect(
      rewards.redeem(f.user.id, {
        rewardProductId: f.reward.id,
        idempotencyKey: randomUUID(),
        pointsRequired: 1,
      }),
    ).rejects.toThrow();
    await prisma.rewardProduct.update({
      where: { id: f.reward.id },
      data: { pointsRequired: 120 },
    });
    const result = await redeem(f);
    for (const quantity of [2, -1, 0.5, NaN])
      await expect(
        carts.updateQuantity(f.user.id, result.cartItem!.id, quantity),
      ).rejects.toThrow();
    expect((await rewards.getBalance(f.user.id)).reservedPoints).toBe(120);
  });
  it.each(['reward', 'size', 'product', 'category'] as const)(
    'chặn đổi khi %s ngừng hoạt động',
    async (kind) => {
      const f = await fixture();
      if (kind === 'reward')
        await prisma.rewardProduct.update({
          where: { id: f.reward.id },
          data: { isActive: false },
        });
      if (kind === 'size')
        await prisma.productSize.update({
          where: { id: f.size.id },
          data: { isActive: false },
        });
      if (kind === 'product')
        await prisma.product.update({
          where: { id: f.product.id },
          data: { isActive: false },
        });
      if (kind === 'category')
        await prisma.category.update({
          where: { id: f.category.id },
          data: { isActive: false },
        });
      await expect(redeem(f)).rejects.toThrow('không thể đổi thưởng');
      expect((await rewards.getBalance(f.user.id)).reservedPoints).toBe(0);
    },
  );
  it('món thường không gộp vào món thưởng; cả hai cùng tính giới hạn tồn kho', async () => {
    const f = await fixture(120, 2);
    await redeem(f);
    await carts.addToCart(f.user.id, {
      productId: f.product.id,
      productSizeId: f.size.id,
      quantity: 1,
    });
    const cart = await carts.getCart(f.user.id);
    expect(cart.items).toHaveLength(2);
    expect(cart.totalAmount).toBe(50000);
    await expect(
      carts.addToCart(f.user.id, {
        productId: f.product.id,
        productSizeId: f.size.id,
        quantity: 1,
      }),
    ).rejects.toThrow('tối đa');
    const regular = cart.items.find((item) => !item.isReward)!;
    await expect(
      carts.updateQuantity(f.user.id, regular.id, 2),
    ).rejects.toThrow('vượt tồn kho');
  });
  it('giỏ đã đủ số lượng tồn kho không thể thêm món thưởng', async () => {
    const f = await fixture(120, 1);
    await carts.addToCart(f.user.id, {
      productId: f.product.id,
      productSizeId: f.size.id,
      quantity: 1,
    });
    await expect(redeem(f)).rejects.toThrow('tồn kho');
  });
  it('báo giá dùng món thuộc tài khoản; không nhận giá hoặc cờ đổi thưởng từ client', async () => {
    const f = await fixture();
    const other = await customer();
    await redeem(f);
    const itemIds = (await carts.getCart(f.user.id)).items.map(
      (item) => item.id,
    );
    expect(
      (await cartQuotes.quote(f.user.id, { itemIds })).finalAmount.toNumber(),
    ).toBe(0);
    await expect(cartQuotes.quote(other.id, { itemIds })).rejects.toThrow(
      'không thuộc giỏ',
    );
    await expect(
      cartQuotes.quote(f.user.id, { itemIds, unitPrice: 0 }),
    ).rejects.toThrow();
    await expect(
      cartQuotes.quote(f.user.id, { itemIds, isReward: true }),
    ).rejects.toThrow();
    await expect(carts.removeItem(other.id, itemIds[0])).resolves.toMatchObject(
      { count: 0 },
    );
    expect((await rewards.getBalance(f.user.id)).reservedPoints).toBe(120);
  });

  it('báo giá món thưởng và món mua thường đúng thứ tự mà không cần Order', async () => {
    const f = await fixture();
    await redeem(f);
    await carts.addToCart(f.user.id, {
      productId: f.product.id,
      productSizeId: f.size.id,
      quantity: 1,
    });
    const items = (await carts.getCart(f.user.id)).items;
    const reward = items.find((item) => item.isReward)!;
    const regular = items.find((item) => !item.isReward)!;
    for (const itemIds of [
      [reward.id, regular.id],
      [regular.id, reward.id],
    ]) {
      const quote = await cartQuotes.quote(f.user.id, { itemIds });
      expect(quote.totalAmount.toNumber()).toBe(50000);
      expect(quote.finalAmount.toNumber()).toBe(50000);
      expect(quote.items.map((item) => item.cartItemId)).toEqual(itemIds);
      expect(
        quote.items
          .find((item) => item.cartItemId === reward.id)!
          .unitPrice.toNumber(),
      ).toBe(0);
      expect(
        quote.items
          .find((item) => item.cartItemId === regular.id)!
          .unitPrice.toNumber(),
      ).toBe(50000);
    }
    expect(
      (
        await cartQuotes.quote(f.user.id, { itemIds: [reward.id] })
      ).finalAmount.toNumber(),
    ).toBe(0);
    expect(
      (
        await cartQuotes.quote(f.user.id, { itemIds: [regular.id] })
      ).finalAmount.toNumber(),
    ).toBe(50000);
    await expect(
      cartQuotes.quote(f.user.id, {
        itemIds: [reward.id],
        code: 'NOT-FOR-REWARDS',
      }),
    ).rejects.toThrow('chỉ áp dụng');
  });

  it('báo giá kiểm tra lại tồn kho và trạng thái phần thưởng nhưng không trừ điểm', async () => {
    const f = await fixture();
    const redeemed = await redeem(f);
    const itemIds = [redeemed.cartItem!.id];
    await prisma.product.update({
      where: { id: f.product.id },
      data: { stockQuantity: 0 },
    });
    await expect(cartQuotes.quote(f.user.id, { itemIds })).rejects.toThrow(
      'khả dụng',
    );
    await prisma.product.update({
      where: { id: f.product.id },
      data: { stockQuantity: 10 },
    });
    await prisma.rewardProduct.update({
      where: { id: f.reward.id },
      data: { isActive: false },
    });
    await expect(cartQuotes.quote(f.user.id, { itemIds })).rejects.toThrow(
      'khả dụng',
    );
    expect(await rewards.getBalance(f.user.id)).toMatchObject({
      pointsBalance: 500,
      reservedPoints: 120,
    });
    await carts.removeItem(f.user.id, itemIds[0]);
    expect((await rewards.getBalance(f.user.id)).availablePoints).toBe(500);
  });

  it('giữ mức điểm đã chụp và giải phóng chính xác sau khi cấu hình điểm thay đổi', async () => {
    const f = await fixture();
    const redeemed = await redeem(f);
    await prisma.rewardProduct.update({
      where: { id: f.reward.id },
      data: { pointsRequired: 450 },
    });
    expect((await carts.getCart(f.user.id)).items[0].rewardPoints).toBe(120);
    await carts.removeItem(f.user.id, redeemed.cartItem!.id);
    expect(await rewards.getBalance(f.user.id)).toMatchObject({
      pointsBalance: 500,
      reservedPoints: 0,
      availablePoints: 500,
    });
  });
});
