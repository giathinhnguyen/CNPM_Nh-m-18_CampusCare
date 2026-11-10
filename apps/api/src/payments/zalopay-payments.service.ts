import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { toDataURL } from 'qrcode';
import { PrismaService } from '../prisma/prisma.service.js';
import { OrdersService } from '../orders/orders.service.js';
import { lockCustomer } from '../rewards/reward-transactions.js';
import {
  ZalopayGateway,
  zalopayPaymentId,
  zalopayReference,
  type ZalopayResult,
} from './zalopay.gateway.js';

@Injectable()
export class ZalopayPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly gateway: ZalopayGateway,
  ) {}
  configured() {
    return this.gateway.configured();
  }
  async create(userId: string, orderId: string, key: string) {
    this.gateway.assertConfigured();
    const payment = await this.prisma.$transaction(async (tx) => {
      await lockCustomer(tx, userId);
      const order = await this.orders.owned(userId, orderId, tx);
      const previous = await tx.payment.findUnique({
        where: { idempotencyKey: `zalopay:${userId}:${key}` },
      });
      if (previous && previous.orderId !== orderId)
        throw new ConflictException('Mã yêu cầu đã dùng cho đơn khác');
      if (previous && previous.status !== 'PENDING') return previous;
      if (
        order.status !== 'PENDING_PAYMENT' ||
        order.inventoryStatus !== 'RESERVED' ||
        order.reservationExpiresAt <= new Date()
      )
        throw new ConflictException('Đơn không còn trong thời gian thanh toán');
      if (order.payments.some((p) => p.needsReview || p.status === 'SUCCESS'))
        throw new ConflictException('Đơn đang cần đối soát');
      const pending = await tx.payment.findFirst({
        where: { orderId, status: 'PENDING' },
      });
      if (pending && pending.paymentMethod !== 'ZALOPAY')
        throw new ConflictException(
          'Đơn đang có giao dịch tại cổng khác. Hãy kiểm tra kết quả trước.',
        );
      if (previous || pending) return previous ?? pending!;
      if (order.reservationExpiresAt.getTime() - Date.now() < 300000)
        throw new ConflictException(
          'ZaloPay cần ít nhất 5 phút còn lại để tạo QR. Hãy hủy đơn và đặt lại.',
        );
      if (order.finalAmount.lt(1000) || order.finalAmount.gt(50000000))
        throw new BadRequestException(
          'Số tiền ZaloPay phải từ 1.000đ đến 50.000.000đ.',
        );
      return tx.payment.create({
        data: {
          id: randomUUID(),
          orderId,
          idempotencyKey: `zalopay:${userId}:${key}`,
          paymentMethod: 'ZALOPAY',
          amount: order.finalAmount,
        },
      });
    });
    if (payment.status !== 'PENDING' || payment.paymentUrl)
      return this.response(payment);
    const order = await this.orders.owned(userId, orderId);
    const result = await this.gateway.create(
      zalopayReference(payment.id, payment.createdAt),
      payment.amount.toNumber(),
      userId,
      `BrewLite ${order.orderCode}`,
      order.reservationExpiresAt,
    );
    await this.prisma.$transaction(async (tx) => {
      await lockCustomer(tx, userId);
      const current = await tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
      });
      if (current.status !== 'PENDING') return;
      if (result.rejected) {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: 'FAILED',
            rawResponse: {
              source: 'zalopay-create-rejected',
              code: result.code,
            },
          },
        });
        await tx.order.updateMany({
          where: { id: orderId, status: 'PENDING_PAYMENT' },
          data: { status: 'PAYMENT_FAILED' },
        });
      } else if (result.paymentUrl)
        await tx.payment.update({
          where: { id: payment.id },
          data: { paymentUrl: result.paymentUrl },
        });
    });
    const current = await this.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    if (current.status === 'SUCCESS' || current.paymentUrl)
      return this.response(current);
    throw new ServiceUnavailableException(
      result.rejected
        ? `ZaloPay từ chối tạo QR (mã ${result.code}). Kiểm tra cấu hình rồi thử lại từ đơn hàng.`
        : 'Chưa nhận được URL ZaloPay. Vui lòng kiểm tra trạng thái trước khi thử lại.',
    );
  }
  private response(payment: {
    id: string;
    orderId: string;
    status: string;
    paymentUrl: string | null;
  }) {
    return {
      id: payment.id,
      orderId: payment.orderId,
      status: payment.status,
      paymentUrl: payment.status === 'PENDING' ? payment.paymentUrl : null,
    };
  }
  private async referencePayment(reference: string) {
    const id = zalopayPaymentId(reference);
    const payment = id
      ? await this.prisma.payment.findUnique({
          where: { id },
          include: { order: true },
        })
      : null;
    if (
      !payment ||
      payment.paymentMethod !== 'ZALOPAY' ||
      zalopayReference(payment.id, payment.createdAt) !== reference
    )
      throw new NotFoundException('Không tìm thấy giao dịch ZaloPay');
    return payment;
  }
  private async apply(reference: string, result: ZalopayResult) {
    const payment = await this.referencePayment(reference);
    if (result.state === 'PENDING') return;
    // Expiry responses may omit amount; a successful payment must always match it.
    if (
      (result.state === 'SUCCESS' ||
        (result.amount !== null && result.amount !== '0')) &&
      (!result.amount || !payment.amount.eq(result.amount))
    )
      throw new BadRequestException('Số tiền ZaloPay không khớp đơn hàng');
    if (
      result.state === 'SUCCESS' &&
      (!result.transactionId || !/^[1-9]\d{0,24}$/.test(result.transactionId))
    )
      throw new BadRequestException('Thiếu mã giao dịch ZaloPay thành công');
    await this.prisma.$transaction(
      async (tx) => {
        await lockCustomer(tx, payment.order.userId);
        const current = await tx.payment.findUniqueOrThrow({
          where: { id: payment.id },
        });
        const order = await tx.order.findUniqueOrThrow({
          where: { id: payment.orderId },
        });
        if (current.status === 'SUCCESS') return;
        if (result.state === 'SUCCESS') {
          const late =
            current.status === 'FAILED' ||
            !['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status) ||
            order.inventoryStatus !== 'RESERVED' ||
            order.reservationExpiresAt <= new Date();
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'SUCCESS',
              transactionId: result.transactionId,
              needsReview: late,
              rawResponse: { ...result, source: 'zalopay-verified' },
            },
          });
          if (!late) await this.orders.markPaid(tx, order.id);
        } else if (current.status === 'PENDING') {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'FAILED',
              rawResponse: { ...result, source: 'zalopay-query' },
            },
          });
          if (
            order.status === 'PENDING_PAYMENT' &&
            order.inventoryStatus === 'RESERVED'
          )
            await tx.order.update({
              where: { id: order.id },
              data: { status: 'PAYMENT_FAILED' },
            });
        }
      },
      { timeout: 15000 },
    );
  }
  async callback(body: unknown) {
    const data = this.gateway.verifyCallback(body);
    if (!data) return { return_code: 2, return_message: 'Invalid callback' };
    await this.apply(data.reference, {
      state: 'SUCCESS',
      amount: data.amount,
      transactionId: data.transactionId,
      code: 1,
      subCode: 1,
    });
    return { return_code: 1, return_message: 'Success' };
  }
  async returned(body: unknown) {
    const data = this.gateway.verifyRedirect(body);
    if (!data)
      throw new BadRequestException('Chữ ký redirect ZaloPay không hợp lệ');
    const payment = await this.referencePayment(data.reference);
    if (!data.amount || !payment.amount.eq(data.amount))
      throw new BadRequestException('Số tiền redirect ZaloPay không khớp');
    // Browser status is not proof of settlement. Query the provider if the callback was missed.
    if (payment.status === 'PENDING')
      await this.apply(
        data.reference,
        await this.gateway.query(data.reference),
      );
    const current = await this.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { order: true },
    });
    return {
      orderId: current.orderId,
      status: current.order.status,
      paymentStatus: current.status,
      needsReview: current.needsReview,
    };
  }
  async reconcile(userId: string, orderId: string) {
    await this.orders.owned(userId, orderId);
    const payments = await this.prisma.payment.findMany({
      where: { orderId, paymentMethod: 'ZALOPAY', status: 'PENDING' },
    });
    for (const payment of payments) {
      const reference = zalopayReference(payment.id, payment.createdAt);
      await this.apply(reference, await this.gateway.query(reference));
    }
  }
  async cancelPending(userId: string, orderId: string) {
    await this.reconcile(userId, orderId);
    const payments = await this.prisma.payment.findMany({
      where: {
        orderId,
        paymentMethod: 'ZALOPAY',
        status: 'PENDING',
        needsReview: false,
      },
    });
    for (const payment of payments) {
      const reference = zalopayReference(payment.id, payment.createdAt);
      const result = await this.gateway.cancel(reference);
      if (result.cancelled) {
        // Only a provider acknowledgement can invalidate a payable QR.
        await this.apply(reference, {
          state: 'FAILED',
          amount: null,
          transactionId: null,
          code: result.code,
          subCode: result.subCode,
        });
      } else {
        // Payment may have won the race; never release its stock or points.
        await this.apply(reference, await this.gateway.query(reference));
      }
    }
  }
  async qr(userId: string, orderId: string) {
    const order = await this.orders.owned(userId, orderId);
    if (
      order.status !== 'PENDING_PAYMENT' ||
      order.reservationExpiresAt <= new Date()
    )
      throw new ConflictException('Đơn không còn trong thời gian thanh toán');
    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        paymentMethod: 'ZALOPAY',
        status: 'PENDING',
        needsReview: false,
      },
    });
    if (!payment?.paymentUrl)
      throw new ConflictException(
        'Chưa có mã QR ZaloPay. Vui lòng khởi tạo thanh toán hoặc kiểm tra trạng thái.',
      );
    return {
      paymentUrl: payment.paymentUrl,
      qrDataUrl: await toDataURL(payment.paymentUrl, {
        width: 320,
        margin: 4,
        errorCorrectionLevel: 'M',
      }),
      amount: payment.amount.toFixed(0),
      expiresAt: order.reservationExpiresAt,
    };
  }
}
