import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { normalizeCustomerPhone } from './phone.js';
import {
  isUuid,
  lockCustomer,
  releaseRedemption,
  validateObject,
} from '../rewards/reward-transactions.js';

const details = {
  items: {
    include: { toppings: true, product: { select: { imageUrl: true } } },
  },
  payments: {
    select: {
      id: true,
      status: true,
      paymentMethod: true,
      transactionId: true,
      amount: true,
      needsReview: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
  loyaltyTxs: { select: { type: true, pointsChange: true } },
  refunds: {
    select: { id: true, amount: true, reason: true, status: true, mode: true, providerRefundId: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: 'desc' as const },
  },
};

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly promotions: PromotionsService,
  ) {}

  async create(userId: string, body: unknown) {
    const input = validateObject(body, [
      'itemIds',
      'code',
      'idempotencyKey',
      'customerName',
      'customerPhone',
      'note',
      'expectedAmount',
    ]);
    const customerPhone = normalizeCustomerPhone(input.customerPhone);
    if (
      !Array.isArray(input.itemIds) ||
      !input.itemIds.length ||
      input.itemIds.length > 100 ||
      !input.itemIds.every(isUuid) ||
      !isUuid(input.idempotencyKey) ||
      typeof input.customerName !== 'string' ||
      !input.customerName.trim() ||
      input.customerName.length > 100 ||
      (input.note != null &&
        (typeof input.note !== 'string' || input.note.length > 255)) ||
      (input.code != null &&
        (typeof input.code !== 'string' || input.code.length > 50)) ||
      typeof input.expectedAmount !== 'number' ||
      !Number.isSafeInteger(input.expectedAmount) ||
      input.expectedAmount < 0
    )
      throw new BadRequestException('Thông tin thanh toán không hợp lệ');
    const itemIds = input.itemIds.map((id) => id.toLowerCase()).sort();
    if (new Set(itemIds).size !== itemIds.length)
      throw new BadRequestException('Danh sách món bị trùng');
    const code =
      typeof input.code === 'string'
        ? input.code.trim().toUpperCase() || null
        : null;
    const checkoutKey = input.idempotencyKey.toLowerCase();
    const customerName = input.customerName.trim();
    const note = typeof input.note === 'string' ? input.note.trim() : null;
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          itemIds,
          code,
          customerName,
          customerPhone,
          note,
          expectedAmount: input.expectedAmount,
        }),
      )
      .digest('hex');
    return this.prisma.$transaction(
      async (tx) => {
        await lockCustomer(tx, userId);
        const previous = await tx.order.findUnique({
          where: { userId_checkoutKey: { userId, checkoutKey } },
          include: details,
        });
        if (previous) {
          if (previous.checkoutPayloadHash !== hash)
            throw new ConflictException(
              'Mã yêu cầu đã dùng cho thông tin khác',
            );
          return previous;
        }
        const items = await tx.cartItem.findMany({
          where: { userId, id: { in: itemIds } },
          orderBy: { id: 'asc' },
          include: {
            product: true,
            productSize: true,
            toppings: { include: { topping: true } },
            rewardRedemption: { include: { rewardProduct: true } },
          },
        });
        if (items.length !== itemIds.length)
          throw new BadRequestException('Món không còn trong giỏ hàng của bạn');
        await this.inventory.assertAvailable(tx, items);
        for (const item of items) {
          if (item.toppings.some((t) => !t.topping.isActive))
            throw new BadRequestException('Topping không còn kinh doanh');
          const reward = item.rewardRedemption;
          if (
            reward &&
            (reward.status !== 'PENDING' ||
              reward.orderId ||
              !reward.rewardProduct.isActive ||
              item.quantity !== 1 ||
              item.toppings.length)
          )
            throw new BadRequestException(
              'Sản phẩm đổi thưởng không còn hợp lệ',
            );
        }
        const regular = items.filter((i) => !i.rewardRedemptionId);
        if (!regular.length && code)
          throw new BadRequestException(
            'Mã giảm giá không áp dụng cho đơn chỉ có quà',
          );
        const zero = new Prisma.Decimal(0);
        const quote = regular.length
          ? await this.promotions.calculateQuote(tx, {
              code,
              items: regular.map((i) => ({
                productSizeId: i.productSizeId,
                quantity: i.quantity,
                toppingIds: i.toppings.map((t) => t.toppingId),
              })),
            })
          : {
              promotionId: null,
              promotionCode: null,
              totalAmount: zero,
              discountAmount: zero,
              finalAmount: zero,
            };
        if (!quote.finalAmount.eq(input.expectedAmount as number))
          throw new ConflictException(
            'Giá hoặc ưu đãi đã thay đổi. Vui lòng kiểm tra và xác nhận lại',
          );
        const order = await tx.order.create({
          data: {
            userId,
            checkoutKey,
            checkoutPayloadHash: hash,
            customerName,
            customerPhone,
            note,
            orderCode: `BL${randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase()}`,
            promotionId: quote.promotionId,
            promotionCode: quote.promotionCode,
            totalAmount: quote.totalAmount,
            discountAmount: quote.discountAmount,
            finalAmount: quote.finalAmount,
            reservationExpiresAt: new Date(Date.now() + 15 * 60000),
            items: {
              create: items.map((item) => {
                const reward = item.rewardRedemption;
                const toppingTotal = item.toppings.reduce(
                  (sum, t) => sum.plus(t.topping.price),
                  zero,
                );
                const unitPrice = reward
                  ? zero
                  : item.product.basePrice
                      .plus(item.productSize.priceAdjustment)
                      .plus(toppingTotal);
                return {
                  productId: item.productId,
                  productName: item.product.name,
                  size: item.productSize.size,
                  sweetnessLevel: item.sweetnessLevel,
                  iceLevel: item.iceLevel,
                  quantity: item.quantity,
                  note: item.note,
                  basePrice: reward ? zero : item.product.basePrice,
                  sizePriceAdjustment: reward
                    ? zero
                    : item.productSize.priceAdjustment,
                  unitPrice,
                  toppingTotal: reward ? zero : toppingTotal,
                  totalPrice: unitPrice.times(item.quantity),
                  rewardRedemptionId: reward?.id,
                  rewardPoints: reward?.totalPointsSpent,
                  toppings: {
                    create: item.toppings.map((t) => ({
                      toppingId: t.toppingId,
                      toppingName: t.topping.name,
                      toppingPrice: t.topping.price,
                    })),
                  },
                };
              }),
            },
          },
        });
        await this.inventory.reserve(tx, order.id, items);
        await tx.rewardRedemption.updateMany({
          where: {
            id: {
              in: items.flatMap((i) =>
                i.rewardRedemptionId ? [i.rewardRedemptionId] : [],
              ),
            },
          },
          data: { orderId: order.id },
        });
        await tx.cartItem.deleteMany({
          where: { userId, id: { in: itemIds } },
        });
        if (order.finalAmount.isZero()) await this.markPaid(tx, order.id);
        return tx.order.findUniqueOrThrow({
          where: { id: order.id },
          include: details,
        });
      },
      { maxWait: 10000, timeout: 20000 },
    );
  }

  async owned(
    userId: string,
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    if (!isUuid(id)) throw new BadRequestException('Mã đơn không hợp lệ');
    const order = await tx.order.findFirst({
      where: { id, userId },
      include: details,
    });
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    return order;
  }
  list(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      include: details,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markPaid(tx: Prisma.TransactionClient, id: string) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id },
      include: { rewardRedemptions: true },
    });
    if (order.status === 'PAID') return;
    if (
      !['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status) ||
      order.inventoryStatus !== 'RESERVED'
    )
      throw new ConflictException('Đơn cần đối soát trước khi xác nhận');
    await this.inventory.settle(tx, id, 'DEDUCTED');
    for (const redemption of order.rewardRedemptions) {
      if (redemption.status !== 'PENDING')
        throw new ConflictException('Điểm giữ cho đơn không hợp lệ');
      await tx.user.update({
        where: { id: order.userId },
        data: {
          reservedPoints: { decrement: redemption.totalPointsSpent },
          loyaltyPoints: { decrement: redemption.totalPointsSpent },
        },
      });
      await tx.rewardRedemption.update({
        where: { id: redemption.id },
        data: { status: 'COMPLETED' },
      });
      await tx.loyaltyTransaction.create({
        data: {
          userId: order.userId,
          orderId: id,
          rewardRedemptionId: redemption.id,
          type: 'REDEEM',
          pointsChange: -redemption.totalPointsSpent,
        },
      });
    }
    const earned = order.finalAmount.div(1000).floor().toNumber();
    if (earned > 0) {
      const user = await tx.user.findUniqueOrThrow({ where: { id: order.userId } });
      const repaid = Math.min(user.loyaltyDebt, earned);
      await tx.user.update({
        where: { id: order.userId },
        data: { loyaltyPoints: { increment: earned - repaid }, loyaltyDebt: { decrement: repaid } },
      });
      await tx.loyaltyTransaction.create({
        data: {
          userId: order.userId,
          orderId: id,
          type: 'EARN',
          pointsChange: earned - repaid,
          debtChange: -repaid,
        },
      });
    }
    await tx.order.update({ where: { id }, data: { status: 'PAID', paidAt: new Date() } });
  }

  async cancel(userId: string, id: string, expired = false) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockCustomer(tx, userId);
        const order = await this.owned(userId, id, tx);
        if (order.status === 'CANCELLED' || order.status === 'EXPIRED')
          return order;
        if (order.status === 'PAID')
          throw new ConflictException(
            'Đơn đã thanh toán không thể hủy tại đây',
          );
        if (expired && order.reservationExpiresAt > new Date()) return order;
        if (order.payments.some((p) => p.status !== 'FAILED' || p.needsReview))
          throw new ConflictException(
            'Giao dịch cần được đối soát trước khi hủy hoặc hoàn nguyên liệu',
          );
        await this.inventory.settle(tx, id, 'RELEASED');
        for (const item of order.items) {
          if (item.rewardRedemptionId) {
            await releaseRedemption(tx, item.rewardRedemptionId);
            continue;
          }
          const size = await tx.productSize.findUnique({
            where: {
              productId_size: { productId: item.productId, size: item.size },
            },
          });
          if (!size) continue;
          await tx.cartItem.create({
            data: {
              userId,
              productId: item.productId,
              productSizeId: size.id,
              quantity: item.quantity,
              sweetnessLevel: item.sweetnessLevel,
              iceLevel: item.iceLevel,
              note: item.note,
              isSelected: false,
              toppings: {
                create: item.toppings.map((t) => ({ toppingId: t.toppingId })),
              },
            },
          });
        }
        await tx.order.update({
          where: { id },
          data: { status: expired ? 'EXPIRED' : 'CANCELLED' },
        });
        return this.owned(userId, id, tx);
      },
      { timeout: 15000 },
    );
  }
}
