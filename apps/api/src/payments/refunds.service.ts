import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import {
  isUuid,
  lockCustomer,
  validateObject,
} from '../rewards/reward-transactions.js';
import { RefundGateway, type RefundResult } from './refund.gateway.js';
import { VnpayGatewayError } from './vnpay.gateway.js';
import { configuredRefundMode } from './refund-mode.js';

export const REFUND_WINDOW_MS = 120000;

@Injectable()
export class RefundsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(RefundsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly inventory: InventoryService,
    private readonly gateway: RefundGateway,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => {
      void this.reconcilePending();
    }, 15000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async accessible(
    actorId: string,
    orderId: string,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    if (!isUuid(orderId)) throw new BadRequestException('Mã đơn không hợp lệ.');
    const actor = await tx.user.findUnique({
      where: { id: actorId },
      select: { role: true },
    });
    const order = actor
      ? await tx.order.findFirst({
          where: {
            id: orderId,
            ...(actor.role === 'ADMIN' ? {} : { userId: actorId }),
          },
        })
      : null;
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng.');
    return order;
  }
  async request(actorId: string, orderId: string, body: unknown) {
    const input = validateObject(body, ['reason']);
    const reason =
      input.reason == null ? 'Yêu cầu hủy đơn trong 2 phút' : input.reason;
    if (
      typeof reason !== 'string' ||
      !reason.trim() ||
      reason.trim().length > 100
    )
      throw new BadRequestException('Lý do hủy phải từ 1 đến 100 ký tự.');
    const refund = await this.prisma.$transaction(
      async (tx) => {
        const initial = await this.accessible(actorId, orderId, tx);
        await lockCustomer(tx, initial.userId);
        const order = await tx.order.findUniqueOrThrow({
          where: { id: orderId },
          include: { payments: true },
        });
        const previous = await tx.refund.findFirst({
          where: { orderId, status: { in: ['PENDING', 'SUCCESS'] } },
          orderBy: { createdAt: 'desc' },
        });
        if (previous) return previous;
        if (
          order.status !== 'PAID' ||
          !order.paidAt ||
          Date.now() >= order.paidAt.getTime() + REFUND_WINDOW_MS
        )
          throw new ConflictException(
            'Chỉ được hủy và hoàn tiền trong 2 phút kể từ khi thanh toán thành công.',
          );
        if (
          order.inventoryStatus !== 'DEDUCTED' ||
          order.payments.some((p) => p.needsReview || p.status === 'PENDING')
        )
          throw new ConflictException('Đơn cần đối soát trước khi hoàn tiền.');
        const successful = order.payments.filter((p) => p.status === 'SUCCESS');
        const payment = successful[0];
        if (
          !order.finalAmount.isZero() &&
          (successful.length !== 1 ||
            !payment?.transactionId ||
            !payment.amount.eq(order.finalAmount) ||
            !['VNPAY', 'ZALOPAY'].includes(payment.paymentMethod))
        )
          throw new ConflictException(
            'Không tìm thấy giao dịch cổng hợp lệ để hoàn tiền.',
          );
        const mode = order.finalAmount.isZero()
          ? 'GATEWAY'
          : configuredRefundMode(payment?.paymentMethod);
        if (!order.finalAmount.isZero() && mode === 'GATEWAY')
          this.gateway.assertConfigured(payment.paymentMethod);
        const id = randomUUID();
        const createdAt = new Date();
        const result = await tx.refund.create({
          data: {
            id,
            orderId,
            requestedById: actorId,
            paymentId: payment?.id,
            amount: order.finalAmount,
            mode,
            reason: reason.trim(),
            createdAt,
            providerReference:
              mode === 'SIMULATION'
                ? `SIM${id.replaceAll('-', '')}`
                : this.gateway.reference(
                    id,
                    payment?.paymentMethod ?? 'INTERNAL',
                    createdAt,
                  ),
          },
        });
        await tx.order.update({
          where: { id: orderId },
          data: { status: 'REFUND_PENDING' },
        });
        return result;
      },
      { timeout: 15000 },
    );
    if (refund.status === 'PENDING') await this.process(refund.id);
    const order = await this.accessible(actorId, orderId);
    return this.orders.owned(order.userId, orderId);
  }
  async reconcile(actorId: string, orderId: string) {
    const order = await this.accessible(actorId, orderId);
    const pending = await this.prisma.refund.findFirst({
      where: { orderId, status: 'PENDING' },
    });
    if (pending) await this.process(pending.id);
    return this.orders.owned(order.userId, orderId);
  }
  private async process(id: string) {
    const refund = await this.prisma.refund.findUniqueOrThrow({
      where: { id },
      include: { payment: true },
    });
    if (refund.status !== 'PENDING') return;
    // Persisted mode, never a global switch for already submitted gateway refunds.
    if (refund.mode === 'SIMULATION')
      return this.apply(id, { state: 'SUCCESS', code: 'SIMULATED_REFUND' });
    if (refund.amount.isZero())
      return this.apply(id, { state: 'SUCCESS', code: 'ZERO_AMOUNT' });
    if (!refund.payment) return;
    // Claim before sending money instructions; retries query the same persisted reference.
    const claim = await this.prisma.refund.updateMany({
      where: { id, status: 'PENDING', submittedAt: null },
      data: { submittedAt: new Date() },
    });
    await this.prisma.refund.update({
      where: { id },
      data: { lastCheckedAt: new Date() },
    });
    try {
      const request = {
        ...refund,
        payment: refund.payment,
        amount: refund.amount.toFixed(0),
      };
      const result =
        claim.count === 1
          ? await this.gateway.submit(request)
          : await this.gateway.query(request);
      await this.apply(id, result);
    } catch (error) {
      // Never turn a timeout, malformed receipt, DB failure or unknown reply into a new refund.
      const code =
        error instanceof VnpayGatewayError
          ? error.code
          : 'REFUND_PROCESSING_ERROR';
      try {
        await this.prisma.refund.updateMany({
          where: { id, status: 'PENDING' },
          data: {
            rawResponse: {
              code,
              stage: claim.count === 1 ? 'submit' : 'query',
            },
          },
        });
      } catch {
        // A local persistence failure must not trigger another money instruction.
      }
      this.logger.warn(`Refund ${id} awaits reconciliation (${code})`);
    }
  }
  private async apply(id: string, result: RefundResult) {
    const initial = await this.prisma.refund.findUniqueOrThrow({
      where: { id },
      include: { order: true },
    });
    await this.prisma.$transaction(
      async (tx) => {
        await lockCustomer(tx, initial.order.userId);
        const refund = await tx.refund.findUniqueOrThrow({ where: { id } });
        if (refund.status !== 'PENDING') return;
        if (result.state === 'SUCCESS') {
          const order = await tx.order.findUniqueOrThrow({
            where: { id: refund.orderId },
            include: { rewardRedemptions: true },
          });
          if (order.status !== 'REFUND_PENDING')
            throw new ConflictException(
              'Trạng thái đơn hoàn tiền không hợp lệ.',
            );
          await this.inventory.restoreRefund(tx, order.id);
          for (const redemption of order.rewardRedemptions) {
            if (redemption.status !== 'COMPLETED') continue;
            await tx.user.update({
              where: { id: order.userId },
              data: {
                loyaltyPoints: { increment: redemption.totalPointsSpent },
              },
            });
            await tx.loyaltyTransaction.create({
              data: {
                userId: order.userId,
                orderId: order.id,
                rewardRedemptionId: redemption.id,
                type: 'REFUND_REDEEM',
                pointsChange: redemption.totalPointsSpent,
                description: 'Hoàn điểm đổi thưởng khi hủy đơn đã thanh toán',
              },
            });
            await tx.rewardRedemption.update({
              where: { id: redemption.id },
              data: { status: 'CANCELLED' },
            });
          }
          const earnings = await tx.loyaltyTransaction.findMany({
            where: { orderId: order.id, type: 'EARN' },
          });
          const earned = earnings.reduce(
            (sum, item) => sum + item.pointsChange - item.debtChange,
            0,
          );
          if (earned > 0) {
            const user = await tx.user.findUniqueOrThrow({
              where: { id: order.userId },
            });
            const recovered = Math.min(
              earned,
              user.loyaltyPoints - user.reservedPoints,
            );
            const debt = earned - recovered;
            await tx.user.update({
              where: { id: user.id },
              data: {
                loyaltyPoints: { decrement: recovered },
                loyaltyDebt: { increment: debt },
              },
            });
            await tx.loyaltyTransaction.create({
              data: {
                userId: user.id,
                orderId: order.id,
                type: 'REFUND_EARN',
                pointsChange: -recovered,
                debtChange: debt,
                description:
                  'Thu hồi điểm của đơn hoàn tiền; điểm đã dùng được bù từ lượt tích điểm sau',
              },
            });
          }
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'REFUNDED' },
          });
        } else if (result.state === 'FAILED') {
          await tx.order.updateMany({
            where: { id: refund.orderId, status: 'REFUND_PENDING' },
            data: { status: 'PAID' },
          });
        }
        await tx.refund.update({
          where: { id },
          data: {
            status: result.state,
            providerRefundId: result.providerRefundId,
            rawResponse: {
              code: result.code,
              ...(refund.mode === 'SIMULATION' ? { simulated: true } : {}),
            },
            lastCheckedAt: new Date(),
          },
        });
      },
      { timeout: 15000 },
    );
  }
  async reconcilePending() {
    if (this.running) return;
    this.running = true;
    try {
      const refunds = await this.prisma.refund.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { lastCheckedAt: null },
            { lastCheckedAt: { lt: new Date(Date.now() - 15000) } },
          ],
        },
        take: 20,
        orderBy: { createdAt: 'asc' },
      });
      for (let offset = 0; offset < refunds.length; offset += 4)
        await Promise.allSettled(
          refunds
            .slice(offset, offset + 4)
            .map((item) => this.process(item.id)),
        );
    } catch {
      this.logger.warn('Could not reconcile pending refunds');
    } finally {
      this.running = false;
    }
  }
}
