import 'dotenv/config';
import { createHmac, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { InventoryService } from '../src/inventory/inventory.service.js';
import { OrdersService } from '../src/orders/orders.service.js';
import { PromotionsService } from '../src/promotions/promotions.service.js';
import { PaymentsService } from '../src/payments/payments.service.js';
import { VnpayGateway, queryString } from '../src/payments/vnpay.gateway.js';
import { RewardsService } from '../src/rewards/rewards.service.js';
import { recipeFixture } from './inventory-fixture.js';

describe('Checkout, shared ingredients and verified VNPay', () => {
  const prisma = new PrismaClient();
  const database = prisma as PrismaService;
  const inventory = new InventoryService(database);
  const orders = new OrdersService(
    database,
    inventory,
    new PromotionsService(database),
  );
  const gateway = new VnpayGateway();
  const payments = new PaymentsService(database, orders, gateway);
  const users: string[] = [],
    categories: string[] = [],
    ingredients: string[] = [];
  const previousMerchant = process.env.VNPAY_TMN_CODE,
    previousSecret = process.env.VNPAY_HASH_SECRET;
  process.env.VNPAY_TMN_CODE = 'TESTONLY';
  process.env.VNPAY_HASH_SECRET = 'test-secret-not-a-merchant-key';
  async function customer() {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@checkout.invalid`,
        googleId: randomUUID(),
        fullName: 'Checkout test',
        loyaltyPoints: 500,
      },
    });
    users.push(user.id);
    return user;
  }
  async function fixture(cups = 10) {
    const user = await customer();
    const category = await prisma.category.create({
      data: { name: randomUUID(), slug: randomUUID() },
    });
    categories.push(category.id);
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        name: 'Fixture drink',
        basePrice: 50000,
        stockQuantity: 0,
      },
    });
    const size = await prisma.productSize.create({
      data: { productId: product.id, size: 'M' },
    });
    const ingredient = await recipeFixture(prisma, size.id, cups);
    ingredients.push(ingredient.id);
    return { user, category, product, size, ingredient };
  }
  async function cart(
    f: Awaited<ReturnType<typeof fixture>>,
    userId = f.user.id,
    quantity = 1,
  ) {
    return prisma.cartItem.create({
      data: {
        userId,
        productId: f.product.id,
        productSizeId: f.size.id,
        quantity,
      },
    });
  }
  const body = (itemId: string, expectedAmount = 50000) => ({
    itemIds: [itemId],
    expectedAmount,
    customerName: 'Test customer',
    customerPhone: '0901234567',
    idempotencyKey: randomUUID(),
  });
  function callback(id: string, amount = '5000000', status = '00') {
    const params = {
      vnp_TmnCode: 'TESTONLY',
      vnp_TxnRef: id,
      vnp_Amount: amount,
      vnp_ResponseCode: status === '00' ? '00' : '24',
      vnp_TransactionStatus: status,
      vnp_TransactionNo:
        String(Date.now()) + String(Math.floor(Math.random() * 10)),
    };
    return {
      ...params,
      vnp_SecureHash: createHmac('sha512', process.env.VNPAY_HASH_SECRET!)
        .update(queryString(params))
        .digest('hex'),
    };
  }
  afterAll(async () => {
    const ids = (
      await prisma.order.findMany({
        where: { userId: { in: users } },
        select: { id: true },
      })
    ).map((o) => o.id);
    await prisma.cartItem.deleteMany({ where: { userId: { in: users } } });
    await prisma.payment.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.loyaltyTransaction.deleteMany({
      where: { userId: { in: users } },
    });
    await prisma.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.rewardRedemption.deleteMany({
      where: { userId: { in: users } },
    });
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.rewardProduct.deleteMany({
      where: { productSize: { product: { categoryId: { in: categories } } } },
    });
    await prisma.product.deleteMany({
      where: { categoryId: { in: categories } },
    });
    await prisma.category.deleteMany({ where: { id: { in: categories } } });
    await prisma.ingredientStock.deleteMany({
      where: { ingredientId: { in: ingredients } },
    });
    await prisma.ingredient.deleteMany({ where: { id: { in: ingredients } } });
    if (previousMerchant === undefined) delete process.env.VNPAY_TMN_CODE;
    else process.env.VNPAY_TMN_CODE = previousMerchant;
    if (previousSecret === undefined) delete process.env.VNPAY_HASH_SECRET;
    else process.env.VNPAY_HASH_SECRET = previousSecret;
    await prisma.$disconnect();
  });

  it('aggregates shared ingredients, adjusts only sugar, ignores ice and rejects missing recipes', async () => {
    const f = await fixture();
    await prisma.productIngredient.update({
      where: {
        productSizeId_ingredientId: {
          productSizeId: f.size.id,
          ingredientId: f.ingredient.id,
        },
      },
      data: { adjustmentGroup: 'SUGAR' },
    });
    const calculated = await inventory.requirements(prisma, [
      {
        productSizeId: f.size.id,
        quantity: 2,
        sweetnessLevel: 'FIFTY',
        iceLevel: 'ONE_TWENTY',
      },
      {
        productSizeId: f.size.id,
        quantity: 1,
        sweetnessLevel: 'ONE_TWENTY',
        iceLevel: 'ZERO',
      },
    ]);
    expect(calculated.usage).toEqual([
      { ingredientId: f.ingredient.id, quantity: '44.000' },
    ]);
    expect(calculated.cost.toNumber()).toBe(88);
    const missing = await prisma.productSize.create({
      data: { productId: f.product.id, size: 'S' },
    });
    expect(await inventory.availability(missing.id)).toBe(0);
    await expect(
      inventory.assertAvailable(prisma, [
        { productSizeId: missing.id, quantity: 1 },
      ]),
    ).rejects.toThrow('công thức');
  });

  it('two customers competing for shared stock cannot oversell; failed transaction leaves cart intact', async () => {
    const f = await fixture(1);
    const other = await customer();
    const a = await cart(f),
      b = await cart(f, other.id);
    const results = await Promise.allSettled([
      orders.create(f.user.id, body(a.id)),
      orders.create(other.id, body(b.id)),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(
      await prisma.cartItem.count({ where: { id: { in: [a.id, b.id] } } }),
    ).toBe(1);
    const stock = await prisma.ingredientStock.findUniqueOrThrow({
      where: { ingredientId: f.ingredient.id },
    });
    expect(stock.reserved.toNumber()).toBe(20);
    expect(stock.onHand.toNumber()).toBe(20);
  });

  it('checkout and payment retries are idempotent; duplicate signed callbacks earn points and deduct snapshot once', async () => {
    const f = await fixture();
    const item = await cart(f);
    const input = body(item.id);
    const [a, b] = await Promise.all([
      orders.create(f.user.id, input),
      orders.create(f.user.id, input),
    ]);
    expect(a.id).toBe(b.id);
    await expect(
      orders.create(f.user.id, { ...input, customerName: 'changed' }),
    ).rejects.toThrow('khác');
    await prisma.productIngredient.update({
      where: {
        productSizeId_ingredientId: {
          productSizeId: f.size.id,
          ingredientId: f.ingredient.id,
        },
      },
      data: { quantity: 100 },
    });
    const paymentInput = {
      orderId: a.id,
      idempotencyKey: randomUUID(),
      channel: 'card',
    };
    const [p, q] = await Promise.all([
      payments.create(f.user.id, paymentInput, '127.0.0.1'),
      payments.create(f.user.id, paymentInput, '127.0.0.1'),
    ]);
    expect(p.id).toBe(q.id);
    expect(new URL(p.paymentUrl!).searchParams.get('vnp_BankCode')).toBe('VNBANK');
    expect(
      (
        await payments.notification({
          ...callback(p.id),
          vnp_SecureHash: 'bad',
        })
      ).RspCode,
    ).toBe('97');
    expect((await payments.notification(callback(p.id, '100'))).RspCode).toBe(
      '04',
    );
    const notification = callback(p.id);
    await Promise.all([
      payments.notification(notification),
      payments.notification(notification),
    ]);
    expect((await orders.owned(f.user.id, a.id)).status).toBe('PAID');
    const stock = await prisma.ingredientStock.findUniqueOrThrow({
      where: { ingredientId: f.ingredient.id },
    });
    expect(stock.onHand.toNumber()).toBe(180);
    expect(stock.reserved.toNumber()).toBe(0);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: f.user.id } }))
        .loyaltyPoints,
    ).toBe(550);
    expect(
      await prisma.loyaltyTransaction.count({
        where: { orderId: a.id, type: 'EARN' },
      }),
    ).toBe(1);
  });

  it('verified successful return settles once without IPN or QueryDR, including duplicate return and IPN', async () => {
    const f = await fixture();
    const order = await orders.create(f.user.id, body((await cart(f)).id));
    const payment = await payments.create(f.user.id,
      { orderId: order.id, idempotencyKey: randomUUID(), channel: 'card' }, '127.0.0.1');
    const query = vi.spyOn(gateway, 'query').mockRejectedValue(new Error('QueryDR unavailable'));
    try {
      await expect(payments.handleReturn(f.user.id, { ...callback(payment.id), vnp_SecureHash: 'bad' })).rejects.toThrow();
      await expect(payments.handleReturn((await customer()).id, callback(payment.id))).rejects.toThrow();
      await expect(payments.handleReturn(f.user.id, callback(payment.id, '100'))).rejects.toThrow();
      expect((await orders.owned(f.user.id, order.id)).status).toBe('PENDING_PAYMENT');
      const signed = callback(payment.id);
      const paid = await payments.handleReturn(f.user.id, signed);
      expect(paid.status).toBe('PAID');
      await Promise.all([payments.handleReturn(f.user.id, signed), payments.notification(signed)]);
      expect(query).not.toHaveBeenCalled();
      expect(await prisma.loyaltyTransaction.count({where:{orderId:order.id,type:'EARN'}})).toBe(1);
      const stock = await prisma.ingredientStock.findUniqueOrThrow({where:{ingredientId:f.ingredient.id}});
      expect(stock.onHand.toNumber()).toBe(180);
      expect(stock.reserved.toNumber()).toBe(0);
    } finally { query.mockRestore(); }
  });

  it('bank demo failure is idempotent, retries without reserving twice, and success earns only once', async () => {
    const oldFlag = process.env.BANK_TRANSFER_DEMO_ENABLED;
    process.env.BANK_TRANSFER_DEMO_ENABLED = 'true';
    try {
      const f = await fixture();
      const order = await orders.create(f.user.id, body((await cart(f)).id));
      const request = { idempotencyKey: randomUUID() };
      await expect(payments.failBankTransferDemo((await customer()).id, order.id, request)).rejects.toThrow();
      const results = await Promise.all([
        payments.failBankTransferDemo(f.user.id, order.id, request),
        payments.failBankTransferDemo(f.user.id, order.id, request),
      ]);
      expect(results[0].status).toBe('PAYMENT_FAILED');
      expect(await prisma.payment.count({where:{orderId:order.id,status:'FAILED'}})).toBe(1);
      expect(await prisma.loyaltyTransaction.count({where:{orderId:order.id}})).toBe(0);
      let stock = await prisma.ingredientStock.findUniqueOrThrow({where:{ingredientId:f.ingredient.id}});
      expect(stock.onHand.toNumber()).toBe(200);
      expect(stock.reserved.toNumber()).toBe(20);
      await expect(payments.confirmBankTransferDemo(f.user.id, order.id)).rejects.toThrow();
      const retry = await payments.retry(f.user.id, order.id);
      expect(retry.status).toBe('PENDING_PAYMENT');
      expect(retry.reservationExpiresAt).toEqual(order.reservationExpiresAt);
      expect((await payments.failBankTransferDemo(f.user.id, order.id, request)).status).toBe('PENDING_PAYMENT');
      const paid = await payments.confirmBankTransferDemo(f.user.id, order.id);
      expect(paid.status).toBe('PAID');
      await payments.confirmBankTransferDemo(f.user.id, order.id);
      await expect(payments.failBankTransferDemo(f.user.id, order.id, {idempotencyKey:randomUUID()})).rejects.toThrow();
      expect(await prisma.loyaltyTransaction.count({where:{orderId:order.id,type:'EARN'}})).toBe(1);
      stock = await prisma.ingredientStock.findUniqueOrThrow({where:{ingredientId:f.ingredient.id}});
      expect(stock.onHand.toNumber()).toBe(180);
      expect(stock.reserved.toNumber()).toBe(0);
    } finally {
      if (oldFlag === undefined) delete process.env.BANK_TRANSFER_DEMO_ENABLED;
      else process.env.BANK_TRANSFER_DEMO_ENABLED = oldFlag;
    }
  });

  it('failed bank orders can cancel or expire; pending VNPay and production cannot be failed manually', async () => {
    const oldFlag = process.env.BANK_TRANSFER_DEMO_ENABLED;
    const oldEnv = process.env.NODE_ENV;
    process.env.BANK_TRANSFER_DEMO_ENABLED = 'true';
    try {
      const f = await fixture();
      const order = await orders.create(f.user.id, body((await cart(f)).id));
      process.env.NODE_ENV = 'production';
      await expect(payments.failBankTransferDemo(f.user.id, order.id, {idempotencyKey:randomUUID()})).rejects.toThrow();
      process.env.NODE_ENV = 'test';
      await payments.failBankTransferDemo(f.user.id, order.id, {idempotencyKey:randomUUID()});
      await prisma.order.update({where:{id:order.id},data:{createdAt:new Date(Date.now()-60000),reservationExpiresAt:new Date(Date.now()-1000)}});
      await expect(payments.retry(f.user.id, order.id)).rejects.toThrow();
      expect((await payments.reconcile(f.user.id, order.id)).status).toBe('EXPIRED');
      expect((await prisma.ingredientStock.findUniqueOrThrow({where:{ingredientId:f.ingredient.id}})).reserved.toNumber()).toBe(0);
      const next = await orders.create(f.user.id, body((await cart(f)).id));
      await payments.create(f.user.id,{orderId:next.id,idempotencyKey:randomUUID(),channel:'card'},'127.0.0.1');
      await expect(payments.failBankTransferDemo(f.user.id,next.id,{idempotencyKey:randomUUID()})).rejects.toThrow('đối soát');
      await expect(payments.create(f.user.id,{orderId:next.id,idempotencyKey:randomUUID(),channel:'wallet'},'127.0.0.1')).rejects.toThrow();
    } finally {
      if (oldFlag === undefined) delete process.env.BANK_TRANSFER_DEMO_ENABLED;
      else process.env.BANK_TRANSFER_DEMO_ENABLED = oldFlag;
      if (oldEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = oldEnv;
    }
  });

  it('signed return can settle without a login session and only exposes a minimal receipt', async () => {
    const f = await fixture();
    const order = await orders.create(f.user.id, body((await cart(f)).id));
    const payment = await payments.create(f.user.id,
      { orderId: order.id, idempotencyKey: randomUUID(), channel: 'card' }, '127.0.0.1');
    await expect(payments.publicReturn({ ...callback(payment.id), vnp_SecureHash: 'bad' })).rejects.toThrow();
    expect((await orders.owned(f.user.id, order.id)).status).toBe('PENDING_PAYMENT');
    const signed = callback(payment.id);
    const result = await payments.publicReturn(signed);
    expect(result).toEqual({orderId:order.id,status:'PAID',paymentStatus:'SUCCESS',needsReview:false});
    expect(await payments.publicReturn(signed)).toEqual(result);
    expect(await prisma.loyaltyTransaction.count({where:{orderId:order.id,type:'EARN'}})).toBe(1);
  });

  it('signed cancelled return unlocks another payment method without QueryDR, but rejects forged or foreign returns', async () => {
    const f = await fixture();
    const order = await orders.create(f.user.id, body((await cart(f)).id));
    const payment = await payments.create(f.user.id,
      { orderId: order.id, idempotencyKey: randomUUID(), channel: 'card' }, '127.0.0.1');
    const cancelled = callback(payment.id, '5000000', '02');
    const query = vi.spyOn(gateway, 'query').mockRejectedValue(new Error('QueryDR unavailable'));
    try {
      await expect(payments.handleReturn(f.user.id, { ...cancelled, vnp_SecureHash: 'bad' })).rejects.toThrow();
      await expect(payments.handleReturn((await customer()).id, cancelled)).rejects.toThrow();
      await expect(payments.handleReturn(f.user.id, callback(payment.id, '100', '02'))).rejects.toThrow();
      expect((await orders.owned(f.user.id, order.id)).payments[0].status).toBe('PENDING');
      const returned = await payments.handleReturn(f.user.id, cancelled);
      expect(returned.payments[0].status).toBe('FAILED');
      expect(returned.status).toBe('PAYMENT_FAILED');
      await payments.retry(f.user.id, order.id);
      expect(returned.inventoryStatus).toBe('RESERVED');
      expect(query).not.toHaveBeenCalled();
      const oldFlag = process.env.CARD_DEMO_ENABLED;
      process.env.CARD_DEMO_ENABLED = 'true';
      try {
        const paid = await payments.confirmCardDemo(f.user.id, order.id);
        expect(paid.status).toBe('PAID');
        const replay = await payments.handleReturn(f.user.id, cancelled);
        expect(replay.status).toBe('PAID');
        expect(replay.payments.filter(p => p.status === 'SUCCESS')).toHaveLength(1);
      } finally {
        if (oldFlag === undefined) delete process.env.CARD_DEMO_ENABLED;
        else process.env.CARD_DEMO_ENABLED = oldFlag;
      }
    } finally { query.mockRestore(); }
  });

  it('unknown payment blocks cancellation; verified failure releases once; late success is flagged for review', async () => {
    const f = await fixture();
    const order = await orders.create(f.user.id, body((await cart(f)).id));
    const payment = await payments.create(
      f.user.id,
      { orderId: order.id, idempotencyKey: randomUUID(), channel: 'card' },
      '127.0.0.1',
    );
    await expect(orders.cancel(f.user.id, order.id)).rejects.toThrow(
      'đối soát',
    );
    const query = vi
      .spyOn(gateway, 'query')
      .mockRejectedValueOnce(new Error('network timeout'));
    await expect(payments.reconcile(f.user.id, order.id)).rejects.toThrow(
      'timeout',
    );
    query.mockRestore();
    expect((await orders.owned(f.user.id, order.id)).inventoryStatus).toBe(
      'RESERVED',
    );
    await payments.notification(callback(payment.id, '5000000', '02'));
    await Promise.all([
      orders.cancel(f.user.id, order.id),
      orders.cancel(f.user.id, order.id),
    ]);
    expect(await prisma.cartItem.count({ where: { userId: f.user.id } })).toBe(
      1,
    );
    await payments.notification(callback(payment.id));
    const final = await orders.owned(f.user.id, order.id);
    expect(final.status).toBe('CANCELLED');
    expect(final.payments[0].needsReview).toBe(true);
    expect(
      (
        await prisma.ingredientStock.findUniqueOrThrow({
          where: { ingredientId: f.ingredient.id },
        })
      ).onHand.toNumber(),
    ).toBe(200);
  });

  it('demo bank confirmation settles paid and reward items exactly once under duplicate requests', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('BANK_TRANSFER_DEMO_ENABLED', 'true');
    try {
      const f = await fixture();
      const item = await cart(f);
      const reward = await prisma.rewardProduct.create({
        data: { productSizeId: f.size.id, pointsRequired: 100 },
      });
      const redeemed = await new RewardsService(database, inventory).redeem(
        f.user.id,
        { rewardProductId: reward.id, idempotencyKey: randomUUID() },
      );
      const order = await orders.create(f.user.id, {
        ...body(item.id),
        itemIds: [item.id, redeemed.cartItem!.id],
      });
      const results = await Promise.all([
        payments.confirmBankTransferDemo(f.user.id, order.id),
        payments.confirmBankTransferDemo(f.user.id, order.id),
      ]);
      expect(results.every((o) => o.status === 'PAID')).toBe(true);
      const final = await orders.owned(f.user.id, order.id);
      expect(final.inventoryStatus).toBe('DEDUCTED');
      expect(final.payments).toHaveLength(1);
      expect(final.payments[0].paymentMethod).toBe('BANK_TRANSFER');
      expect(final.payments[0].transactionId).toMatch(/^DEMO-/);
      const stock = await prisma.ingredientStock.findUniqueOrThrow({
        where: { ingredientId: f.ingredient.id },
      });
      expect(stock.onHand.toNumber()).toBe(160);
      expect(stock.reserved.toNumber()).toBe(0);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: f.user.id },
      });
      expect(user.loyaltyPoints).toBe(450);
      expect(user.reservedPoints).toBe(0);
      expect(final.loyaltyTxs.filter((t) => t.type === 'EARN')).toHaveLength(1);
      expect(final.loyaltyTxs.filter((t) => t.type === 'REDEEM')).toHaveLength(
        1,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('blocks demo confirmation in production, without flag, on foreign/expired/cancelled orders or pending VNPay', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('BANK_TRANSFER_DEMO_ENABLED', 'true');
    try {
      const f = await fixture();
      const order = await orders.create(f.user.id, body((await cart(f)).id));
      const other = await customer();
      await expect(
        payments.confirmBankTransferDemo(other.id, order.id),
      ).rejects.toThrow('Không tìm thấy');
      vi.stubEnv('NODE_ENV', 'production');
      expect(payments.config().bankTransferDemoEnabled).toBe(false);
      await expect(
        payments.confirmBankTransferDemo(f.user.id, order.id),
      ).rejects.toThrow('chỉ dùng');
      vi.stubEnv('NODE_ENV', 'test');
      vi.stubEnv('BANK_TRANSFER_DEMO_ENABLED', 'false');
      await expect(
        payments.confirmBankTransferDemo(f.user.id, order.id),
      ).rejects.toThrow('chỉ dùng');
      vi.stubEnv('BANK_TRANSFER_DEMO_ENABLED', 'true');
      await payments.create(
        f.user.id,
        { orderId: order.id, idempotencyKey: randomUUID(), channel: 'card' },
        '127.0.0.1',
      );
      await expect(
        payments.confirmBankTransferDemo(f.user.id, order.id),
      ).rejects.toThrow('đối soát');
      const expired = await orders.create(f.user.id, body((await cart(f)).id));
      await prisma.order.update({
        where: { id: expired.id },
        data: {
          createdAt: new Date(Date.now() - 120000),
          reservationExpiresAt: new Date(Date.now() - 60000),
        },
      });
      await expect(
        payments.confirmBankTransferDemo(f.user.id, expired.id),
      ).rejects.toThrow('hết hạn');
      const cancelled = await orders.create(
        f.user.id,
        body((await cart(f)).id),
      );
      await orders.cancel(f.user.id, cancelled.id);
      await expect(
        payments.confirmBankTransferDemo(f.user.id, cancelled.id),
      ).rejects.toThrow('hết hạn');
      expect(
        await prisma.payment.count({
          where: {
            order: { userId: f.user.id },
            paymentMethod: 'BANK_TRANSFER',
          },
        }),
      ).toBe(0);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('allows a new phone on the next order after payment and accepts common phone separators', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('BANK_TRANSFER_DEMO_ENABLED', 'true');
    try {
      const f = await fixture();
      const first = await orders.create(f.user.id, body((await cart(f)).id));
      await payments.confirmBankTransferDemo(f.user.id, first.id);
      const second = await orders.create(f.user.id, {
        ...body((await cart(f)).id),
        customerPhone: '0987654321',
      });
      expect(second.customerPhone).toBe('0987654321');
      await payments.confirmBankTransferDemo(f.user.id, second.id);
      const third = await orders.create(f.user.id, {
        ...body((await cart(f)).id),
        customerPhone: '+84 (912) 345-678',
      });
      expect(third.customerPhone).toBe('0912345678');
      expect((await orders.owned(f.user.id, first.id)).customerPhone).toBe(
        '0901234567',
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('uses the owned order amount for QR and settles demo cards only once', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('CARD_DEMO_ENABLED', 'true');
    vi.stubEnv('BANK_TRANSFER_DEMO_ENABLED', 'true');
    vi.stubEnv('BANK_QR_BIN', '970436');
    vi.stubEnv('BANK_QR_BANK_NAME', 'Vietcombank');
    vi.stubEnv('BANK_QR_ACCOUNT_NUMBER', 'TEST123');
    vi.stubEnv('BANK_QR_ACCOUNT_NAME', 'TEST RECEIVER');
    try {
      const f = await fixture();
      const order = await orders.create(f.user.id, body((await cart(f)).id));
      const qr = await payments.bankQr(f.user.id, order.id);
      expect(qr.configured).toBe(true);
      if (!qr.configured) throw new Error('QR missing');
      expect(new URL(qr.qrUrl).searchParams.get('amount')).toBe('50000');
      expect(new URL(qr.qrUrl).searchParams.get('addInfo')).toBe(
        order.orderCode,
      );
      await expect(
        payments.bankQr((await customer()).id, order.id),
      ).rejects.toThrow('Không tìm thấy');
      vi.stubEnv('NODE_ENV', 'production');
      await expect(
        payments.confirmCardDemo(f.user.id, order.id),
      ).rejects.toThrow('chỉ dùng');
      vi.stubEnv('NODE_ENV', 'test');
      const results = await Promise.all([
        payments.confirmCardDemo(f.user.id, order.id),
        payments.confirmCardDemo(f.user.id, order.id),
      ]);
      expect(results.every((o) => o.status === 'PAID')).toBe(true);
      const final = await orders.owned(f.user.id, order.id);
      expect(final.payments).toHaveLength(1);
      expect(final.payments[0].paymentMethod).toBe('CARD_DEMO');
      expect(final.inventoryStatus).toBe('DEDUCTED');
      expect(final.loyaltyTxs.filter((t) => t.type === 'EARN')).toHaveLength(1);
      await expect(
        payments.confirmBankTransferDemo(f.user.id, order.id),
      ).rejects.toThrow();
      await expect(payments.bankQr(f.user.id, order.id)).rejects.toThrow(
        'thời gian',
      );
      await expect(
        orders.create(f.user.id, {
          ...body((await cart(f)).id),
          customerPhone: '1234121431',
        }),
      ).rejects.toThrow('Số điện thoại');
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('reward-only orders cost zero, consume ingredients and redeem reserved points once', async () => {
    const f = await fixture();
    const reward = await prisma.rewardProduct.create({
      data: { productSizeId: f.size.id, pointsRequired: 100 },
    });
    const rewards = new RewardsService(database, inventory);
    const redeemed = await rewards.redeem(f.user.id, {
      rewardProductId: reward.id,
      idempotencyKey: randomUUID(),
    });
    const input = body(redeemed.cartItem!.id, 0);
    const first = await orders.create(f.user.id, input);
    await orders.create(f.user.id, input);
    expect(first.status).toBe('PAID');
    expect(first.inventoryStatus).toBe('DEDUCTED');
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: f.user.id },
    });
    expect(user.loyaltyPoints).toBe(400);
    expect(user.reservedPoints).toBe(0);
    expect(first.payments).toHaveLength(0);
  });

  it('expires only unpaid reservations and rejects foreign orders and stale amounts', async () => {
    const f = await fixture();
    const item = await cart(f);
    const other = await customer();
    await expect(orders.create(f.user.id, body(item.id, 1))).rejects.toThrow(
      'thay đổi',
    );
    const order = await orders.create(f.user.id, body(item.id));
    await expect(orders.owned(other.id, order.id)).rejects.toThrow(
      'Không tìm thấy',
    );
    await prisma.order.update({
      where: { id: order.id },
      data: {
        createdAt: new Date(Date.now() - 120000),
        reservationExpiresAt: new Date(Date.now() - 60000),
      },
    });
    await payments.reconcile(f.user.id, order.id);
    expect((await orders.owned(f.user.id, order.id)).status).toBe('EXPIRED');
    expect(
      (
        await prisma.ingredientStock.findUniqueOrThrow({
          where: { ingredientId: f.ingredient.id },
        })
      ).reserved.toNumber(),
    ).toBe(0);
  });
});
