import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockInstance,
} from 'vitest';
import { Test } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { InventoryService } from '../src/inventory/inventory.service.js';
import { OrdersService } from '../src/orders/orders.service.js';
import { PromotionsService } from '../src/promotions/promotions.service.js';
import { RefundGateway } from '../src/payments/refund.gateway.js';
import { RefundsService } from '../src/payments/refunds.service.js';
import { RefundsController } from '../src/payments/refunds.controller.js';
import {
  VnpayGateway,
  VnpayGatewayError,
} from '../src/payments/vnpay.gateway.js';
import { lockCustomer } from '../src/rewards/reward-transactions.js';
import { recipeFixture } from './inventory-fixture.js';

describe('Paid-order cancellation and full refunds', () => {
  const prisma = new PrismaClient();
  const db = prisma as PrismaService;
  const inventory = new InventoryService(db);
  const orders = new OrdersService(db, inventory, new PromotionsService(db));
  const gateway = new RefundGateway(new VnpayGateway());
  const refunds = new RefundsService(db, orders, inventory, gateway);
  const users: string[] = [],
    categories: string[] = [],
    ingredients: string[] = [];
  let transaction = Date.now();
  let submitMock: MockInstance<RefundGateway['submit']>;
  let queryMock: MockInstance<RefundGateway['query']>;
  const checkout = (id: string, amount = 50000) => ({
    itemIds: [id],
    expectedAmount: amount,
    idempotencyKey: randomUUID(),
    customerName: 'Refund test',
    customerPhone: '0901234567',
  });
  async function user(role: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER') {
    const result = await prisma.user.create({
      data: {
        email: `${randomUUID()}@refund.invalid`,
        googleId: randomUUID(),
        fullName: 'Refund fixture',
        role,
        loyaltyPoints: 500,
      },
    });
    users.push(result.id);
    return result;
  }
  async function paid(method: 'VNPAY' | 'ZALOPAY' = 'VNPAY') {
    const customer = await user();
    const category = await prisma.category.create({
      data: { name: randomUUID(), slug: randomUUID() },
    });
    categories.push(category.id);
    const product = await prisma.product.create({
      data: { categoryId: category.id, name: 'Refund drink', basePrice: 50000 },
    });
    const size = await prisma.productSize.create({
      data: { productId: product.id, size: 'M' },
    });
    const ingredient = await recipeFixture(prisma, size.id, 10);
    ingredients.push(ingredient.id);
    const item = await prisma.cartItem.create({
      data: {
        userId: customer.id,
        productId: product.id,
        productSizeId: size.id,
        quantity: 1,
      },
    });
    const order = await orders.create(customer.id, checkout(item.id));
    await prisma.$transaction(async (tx) => {
      await lockCustomer(tx, customer.id);
      await tx.payment.create({
        data: {
          orderId: order.id,
          amount: order.finalAmount,
          paymentMethod: method,
          status: 'SUCCESS',
          transactionId: String(++transaction),
          idempotencyKey: randomUUID(),
        },
      });
      await orders.markPaid(tx, order.id);
    });
    return {
      customer,
      order: await orders.owned(customer.id, order.id),
      product,
      size,
      ingredient,
    };
  }
  beforeEach(() => {
    vi.stubEnv('REFUND_MODE', 'gateway');
    vi.stubEnv('VNPAY_TMN_CODE', 'TESTONLY');
    vi.stubEnv('VNPAY_HASH_SECRET', 'test-only');
    vi.stubEnv('ZALOPAY_APP_ID', '1234');
    vi.stubEnv('ZALOPAY_KEY1', 'test-only');
    submitMock = vi.spyOn(gateway, 'submit').mockResolvedValue({
      state: 'SUCCESS',
      code: 'TEST',
      providerRefundId: '1234567',
    });
    queryMock = vi.spyOn(gateway, 'query').mockResolvedValue({
      state: 'SUCCESS',
      code: 'TEST',
      providerRefundId: '1234567',
    });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
  afterAll(async () => {
    refunds.onModuleDestroy();
    const ids = (
      await prisma.order.findMany({
        where: { userId: { in: users } },
        select: { id: true },
      })
    ).map((o) => o.id);
    await prisma.refund.deleteMany({ where: { orderId: { in: ids } } });
    await prisma.cartItem.deleteMany({ where: { userId: { in: users } } });
    await prisma.loyaltyTransaction.deleteMany({
      where: { userId: { in: users } },
    });
    await prisma.payment.deleteMany({ where: { orderId: { in: ids } } });
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
    await prisma.$disconnect();
  });

  it('refunds the owned paid order, restores the snapshot and points, and permits buying the same drink again', async () => {
    const f = await paid();
    const before = await prisma.ingredientStock.findUniqueOrThrow({
      where: { ingredientId: f.ingredient.id },
    });
    const result = await refunds.request(f.customer.id, f.order.id, {
      reason: 'Chọn món khác',
    });
    expect(result.status).toBe('REFUNDED');
    expect(result.inventoryStatus).toBe('RESTORED');
    expect(result.refunds[0].amount.eq(50000)).toBe(true);
    expect(result.payments[0].status).toBe('SUCCESS');
    const stock = await prisma.ingredientStock.findUniqueOrThrow({
      where: { ingredientId: f.ingredient.id },
    });
    const snapshot = f.order.reservedIngredients as {
      ingredientId: string;
      quantity: string;
    }[];
    expect(stock.onHand.minus(before.onHand).eq(snapshot[0].quantity)).toBe(
      true,
    );
    expect(stock.reserved.eq(0)).toBe(true);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: f.customer.id } }))
        .loyaltyPoints,
    ).toBe(500);
    expect(
      await prisma.cartItem.count({ where: { userId: f.customer.id } }),
    ).toBe(0);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: f.product.id } }))
        .isActive,
    ).toBe(true);
    const again = await prisma.cartItem.create({
      data: {
        userId: f.customer.id,
        productId: f.product.id,
        productSizeId: f.size.id,
        quantity: 1,
      },
    });
    expect(
      (await orders.create(f.customer.id, checkout(again.id))).status,
    ).toBe('PENDING_PAYMENT');
  });
  it('allows an administrator to refund another customer, but rejects a foreign customer', async () => {
    const f = await paid();
    const other = await user();
    const admin = await user('ADMIN');
    await expect(refunds.request(other.id, f.order.id, {})).rejects.toThrow(
      'Không tìm thấy',
    );
    expect(submitMock).not.toHaveBeenCalled();
    expect((await refunds.request(admin.id, f.order.id, {})).status).toBe(
      'REFUNDED',
    );
    expect(
      (await prisma.refund.findFirstOrThrow({ where: { orderId: f.order.id } }))
        .requestedById,
    ).toBe(admin.id);
  });
  it.each(['CUSTOMER', 'ADMIN'] as const)(
    'enforces the exact two-minute boundary for %s, without resetting paidAt',
    async (role) => {
      const f = await paid();
      const actor = role === 'ADMIN' ? await user('ADMIN') : f.customer;
      const paidAt = new Date(Date.now() - 120000);
      await prisma.order.update({
        where: { id: f.order.id },
        data: { paidAt },
      });
      await expect(refunds.request(actor.id, f.order.id, {})).rejects.toThrow(
        '2 phút',
      );
      expect(submitMock).not.toHaveBeenCalled();
      expect(
        await prisma.refund.count({ where: { orderId: f.order.id } }),
      ).toBe(0);
      expect(
        (await prisma.order.findUniqueOrThrow({ where: { id: f.order.id } }))
          .paidAt,
      ).toEqual(paidAt);
    },
  );
  it('accepts a request just before the cutoff and completes a pending refund after the cutoff', async () => {
    const f = await paid('ZALOPAY');
    await prisma.order.update({
      where: { id: f.order.id },
      data: { paidAt: new Date(Date.now() - 119000) },
    });
    submitMock.mockResolvedValue({ state: 'PENDING', code: 'QUEUED' });
    expect((await refunds.request(f.customer.id, f.order.id, {})).status).toBe(
      'REFUND_PENDING',
    );
    await prisma.order.update({
      where: { id: f.order.id },
      data: { paidAt: new Date(Date.now() - 180000) },
    });
    expect((await refunds.reconcile(f.customer.id, f.order.id)).status).toBe(
      'REFUNDED',
    );
    expect(submitMock).toHaveBeenCalledTimes(1);
  });
  it('submits once under concurrent cancellation and never reverses stock/points twice', async () => {
    const f = await paid();
    await Promise.all([
      refunds.request(f.customer.id, f.order.id, {}),
      refunds.request(f.customer.id, f.order.id, {}),
    ]);
    await refunds.request(f.customer.id, f.order.id, {});
    await refunds.reconcile(f.customer.id, f.order.id);
    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(await prisma.refund.count({ where: { orderId: f.order.id } })).toBe(
      1,
    );
    expect(
      await prisma.loyaltyTransaction.count({
        where: { orderId: f.order.id, type: 'REFUND_EARN' },
      }),
    ).toBe(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: f.customer.id } }))
        .loyaltyPoints,
    ).toBe(500);
  });
  it('preserves deducted stock and points on timeout and queries the same refund rather than resubmitting', async () => {
    const f = await paid();
    submitMock.mockRejectedValue(new Error('timeout'));
    queryMock.mockResolvedValue({ state: 'PENDING', code: 'UNKNOWN' });
    const first = await refunds.request(f.customer.id, f.order.id, {});
    const second = await refunds.request(f.customer.id, f.order.id, {});
    expect(second.refunds[0].id).toBe(first.refunds[0].id);
    expect(second.status).toBe('REFUND_PENDING');
    expect(second.inventoryStatus).toBe('DEDUCTED');
    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: f.customer.id } }))
        .loyaltyPoints,
    ).toBe(550);
  });
  it('retains safe gateway diagnostics while keeping uncertain refunds pending and never resubmitting', async () => {
    const f = await paid();
    submitMock.mockRejectedValue(
      new VnpayGatewayError(
        'VNPAY_TIMEOUT',
        'private details that must not be saved',
      ),
    );
    queryMock.mockRejectedValue(
      new VnpayGatewayError('VNPAY_UNVERIFIED_99', 'private provider data'),
    );
    const first = await refunds.request(f.customer.id, f.order.id, {});
    const audit = await prisma.refund.findFirstOrThrow({
      where: { orderId: f.order.id },
    });
    expect(audit.rawResponse).toEqual({
      code: 'VNPAY_TIMEOUT',
      stage: 'submit',
    });
    expect(first.status).toBe('REFUND_PENDING');
    expect(JSON.stringify(first)).not.toContain('private details');
    const second = await refunds.reconcile(f.customer.id, f.order.id);
    const checked = await prisma.refund.findUniqueOrThrow({
      where: { id: audit.id },
    });
    expect(checked.rawResponse).toEqual({
      code: 'VNPAY_UNVERIFIED_99',
      stage: 'query',
    });
    expect(second.status).toBe('REFUND_PENDING');
    expect(second.inventoryStatus).toBe('DEDUCTED');
    expect(checked.status).toBe('PENDING');
    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
  it.each(['CUSTOMER', 'ADMIN'] as const)(
    'completes an explicitly simulated %s refund once without calling a bank or inventing a bank reference',
    async (role) => {
      const f = await paid();
      const actor = role === 'ADMIN' ? await user('ADMIN') : f.customer;
      vi.stubEnv('REFUND_MODE', 'simulation');
      vi.stubEnv('VNPAY_TMN_CODE', '');
      vi.stubEnv('VNPAY_HASH_SECRET', '');
      const [result] = await Promise.all([
        refunds.request(actor.id, f.order.id, {}),
        refunds.request(actor.id, f.order.id, {}),
      ]);
      expect(result.status).toBe('REFUNDED');
      expect(result.inventoryStatus).toBe('RESTORED');
      expect(result.refunds[0].mode).toBe('SIMULATION');
      expect(result.refunds[0].providerRefundId).toBeNull();
      const audit = await prisma.refund.findFirstOrThrow({
        where: { orderId: f.order.id },
      });
      expect(audit.rawResponse).toEqual({
        code: 'SIMULATED_REFUND',
        simulated: true,
      });
      expect(audit.providerReference.startsWith('SIM')).toBe(true);
      expect(
        (
          await prisma.ingredientStock.findUniqueOrThrow({
            where: { ingredientId: f.ingredient.id },
          })
        ).onHand.toNumber(),
      ).toBe(200);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: f.customer.id } }))
          .loyaltyPoints,
      ).toBe(500);
      expect(
        await prisma.loyaltyTransaction.count({
          where: { orderId: f.order.id, type: 'REFUND_EARN' },
        }),
      ).toBe(1);
      expect(
        await prisma.refund.count({ where: { orderId: f.order.id } }),
      ).toBe(1);
      expect(
        (
          await prisma.payment.findFirstOrThrow({
            where: { orderId: f.order.id },
          })
        ).status,
      ).toBe('SUCCESS');
      expect(submitMock).not.toHaveBeenCalled();
      expect(queryMock).not.toHaveBeenCalled();
    },
  );
  it('does not convert an existing uncertain gateway refund when simulation is enabled later', async () => {
    const f = await paid();
    submitMock.mockResolvedValue({ state: 'PENDING', code: 'WAIT' });
    queryMock.mockResolvedValue({ state: 'PENDING', code: 'WAIT' });
    await refunds.request(f.customer.id, f.order.id, {});
    vi.stubEnv('REFUND_MODE', 'simulation');
    const result = await refunds.request(f.customer.id, f.order.id, {});
    expect(result.status).toBe('REFUND_PENDING');
    expect(result.inventoryStatus).toBe('DEDUCTED');
    expect(result.refunds[0].mode).toBe('GATEWAY');
    expect(submitMock).toHaveBeenCalledTimes(1);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
  it('retains persisted simulation mode when reconciling after the configuration returns to gateway', async () => {
    const f = await paid();
    await prisma.refund.create({
      data: {
        orderId: f.order.id,
        requestedById: f.customer.id,
        amount: f.order.finalAmount,
        reason: 'Simulation recovery',
        providerReference: 'SIM' + randomUUID().replaceAll('-', ''),
        mode: 'SIMULATION',
      },
    });
    await prisma.order.update({
      where: { id: f.order.id },
      data: { status: 'REFUND_PENDING' },
    });
    const result = await refunds.reconcile(f.customer.id, f.order.id);
    expect(result.status).toBe('REFUNDED');
    expect(result.refunds[0].mode).toBe('SIMULATION');
    expect(submitMock).not.toHaveBeenCalled();
    expect(queryMock).not.toHaveBeenCalled();
  });
  it('keeps the two-minute cutoff and server-only mode selection in simulation', async () => {
    const f = await paid();
    const admin = await user('ADMIN');
    vi.stubEnv('REFUND_MODE', 'simulation');
    await expect(
      refunds.request(f.customer.id, f.order.id, { mode: 'SIMULATION' }),
    ).rejects.toThrow();
    await prisma.order.update({
      where: { id: f.order.id },
      data: { paidAt: new Date(Date.now() - 120001) },
    });
    for (const actor of [f.customer, admin])
      await expect(refunds.request(actor.id, f.order.id, {})).rejects.toThrow(
        '2 phút',
      );
    expect(await prisma.refund.count({ where: { orderId: f.order.id } })).toBe(
      0,
    );
    expect(submitMock).not.toHaveBeenCalled();
  });
  it('retains a rejected refund audit, and permits a new attempt only while the original window remains open', async () => {
    const f = await paid();
    submitMock.mockResolvedValueOnce({ state: 'FAILED', code: 'REJECTED' });
    const failed = await refunds.request(f.customer.id, f.order.id, {});
    expect(failed.status).toBe('PAID');
    expect(failed.inventoryStatus).toBe('DEDUCTED');
    const next = await refunds.request(f.customer.id, f.order.id, {});
    expect(next.status).toBe('REFUNDED');
    expect(next.refunds).toHaveLength(2);
    expect(next.refunds.map((item) => item.status).sort()).toEqual([
      'FAILED',
      'SUCCESS',
    ]);
  });
  it('refunds money even if earned points were spent or reserved elsewhere, and repays debt from future earnings', async () => {
    const f = await paid();
    await prisma.user.update({
      where: { id: f.customer.id },
      data: { loyaltyPoints: 20, reservedPoints: 10 },
    });
    expect((await refunds.request(f.customer.id, f.order.id, {})).status).toBe(
      'REFUNDED',
    );
    const customer = await prisma.user.findUniqueOrThrow({
      where: { id: f.customer.id },
    });
    expect(customer.loyaltyPoints).toBe(10);
    expect(customer.reservedPoints).toBe(10);
    expect(customer.loyaltyDebt).toBe(40);
    const item = await prisma.cartItem.create({
      data: {
        userId: customer.id,
        productId: f.product.id,
        productSizeId: f.size.id,
        quantity: 1,
      },
    });
    const order = await orders.create(customer.id, checkout(item.id));
    await prisma.$transaction(async (tx) => {
      await lockCustomer(tx, customer.id);
      await orders.markPaid(tx, order.id);
    });
    const repaid = await prisma.user.findUniqueOrThrow({
      where: { id: customer.id },
    });
    expect(repaid.loyaltyDebt).toBe(0);
    expect(repaid.loyaltyPoints).toBe(20);
  });
  it('rolls back local fulfillment if inventory cannot be restored, then reconciles without a second money instruction', async () => {
    const f = await paid();
    const original = f.order.reservedIngredients;
    await prisma.order.update({
      where: { id: f.order.id },
      data: { reservedIngredients: [] },
    });
    const restore = vi
      .spyOn(inventory, 'restoreRefund')
      .mockRejectedValueOnce(new Error('stock write failure'));
    expect((await refunds.request(f.customer.id, f.order.id, {})).status).toBe(
      'REFUND_PENDING',
    );
    expect(
      (await prisma.user.findUniqueOrThrow({ where: { id: f.customer.id } }))
        .loyaltyPoints,
    ).toBe(550);
    restore.mockRestore();
    await prisma.order.update({
      where: { id: f.order.id },
      data: { reservedIngredients: original! },
    });
    expect((await refunds.reconcile(f.customer.id, f.order.id)).status).toBe(
      'REFUNDED',
    );
    expect(submitMock).toHaveBeenCalledTimes(1);
  });
  it('protects HTTP endpoints with JWT, validates body fields, and allows a signed-in owner', async () => {
    const f = await paid();
    const module = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: 'refund-test-jwt' })],
      controllers: [RefundsController],
      providers: [
        { provide: RefundsService, useValue: refunds },
        { provide: PrismaService, useValue: db },
      ],
    }).compile();
    const app = module.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    try {
      const path = `/api/payments/orders/${f.order.id}/refund`;
      await request(app.getHttpServer()).post(path).send({}).expect(401);
      const token = await module
        .get(JwtService)
        .signAsync({ sub: f.customer.id }, { expiresIn: '5m' });
      await request(app.getHttpServer())
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send({ amount: 1 })
        .expect(400);
      const response = await request(app.getHttpServer())
        .post(path)
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(201);
      expect(response.body.status).toBe('REFUNDED');
    } finally {
      await app.close();
    }
  });

  it('cancels a zero-money reward order, restores redeemed points and stock without calling a money gateway', async () => {
    const f = await paid();
    const reward = await prisma.rewardProduct.create({
      data: { productSizeId: f.size.id, pointsRequired: 120 },
    });
    const redemption = await prisma.rewardRedemption.create({
      data: {
        userId: f.customer.id,
        rewardProductId: reward.id,
        idempotencyKey: randomUUID(),
        productNameSnapshot: f.product.name,
        sizeSnapshot: 'M',
        pointsRequiredSnapshot: 120,
        totalPointsSpent: 120,
        quantity: 1,
      },
    });
    await prisma.user.update({
      where: { id: f.customer.id },
      data: { reservedPoints: { increment: 120 } },
    });
    const before = await prisma.ingredientStock.findUniqueOrThrow({
      where: { ingredientId: f.ingredient.id },
    });
    const item = await prisma.cartItem.create({
      data: {
        userId: f.customer.id,
        productId: f.product.id,
        productSizeId: f.size.id,
        quantity: 1,
        rewardRedemptionId: redemption.id,
      },
    });
    const order = await orders.create(f.customer.id, checkout(item.id, 0));
    expect(order.status).toBe('PAID');
    expect(order.paidAt).not.toBeNull();
    expect((await refunds.request(f.customer.id, order.id, {})).status).toBe(
      'REFUNDED',
    );
    expect(submitMock).not.toHaveBeenCalled();
    const after = await prisma.ingredientStock.findUniqueOrThrow({
      where: { ingredientId: f.ingredient.id },
    });
    expect(after.onHand.eq(before.onHand)).toBe(true);
    const customer = await prisma.user.findUniqueOrThrow({
      where: { id: f.customer.id },
    });
    expect(customer.loyaltyPoints).toBe(550);
    expect(customer.reservedPoints).toBe(0);
    expect(
      (
        await prisma.rewardRedemption.findUniqueOrThrow({
          where: { id: redemption.id },
        })
      ).status,
    ).toBe('CANCELLED');
  });
});
