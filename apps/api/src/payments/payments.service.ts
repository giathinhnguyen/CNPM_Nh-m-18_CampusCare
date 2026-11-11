import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
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
import {
  isUuid,
  lockCustomer,
  validateObject,
} from '../rewards/reward-transactions.js';
import { VnpayGateway } from './vnpay.gateway.js';
import { bankQrDetails, bankQrReceiver } from './bank-qr.js';
import { ZalopayPaymentsService } from './zalopay-payments.service.js';
import { configuredRefundMode } from './refund-mode.js';

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly gateway: VnpayGateway,
    private readonly zalopay: ZalopayPaymentsService,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.expireOrders();
    }, 15000);
    this.timer.unref();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  config() {
    return {
      provider: 'VNPAY',
      sandbox: true,
      configured: this.gateway.configured(),
      zalopayConfigured: this.zalopay.configured(),
      zalopaySandbox: true,
      bankTransferDemoEnabled: this.bankTransferDemoEnabled(),
      bankQrConfigured: Boolean(bankQrReceiver()),
      cardDemoEnabled: false,
      refundMode: configuredRefundMode(),
    };
  }
  private bankTransferDemoEnabled() {
    return (
      ['development', 'test'].includes(process.env.NODE_ENV ?? '') &&
      process.env.BANK_TRANSFER_DEMO_ENABLED === 'true'
    );
  }
  private cardDemoEnabled() {
    return (
      ['development', 'test'].includes(process.env.NODE_ENV ?? '') &&
      process.env.CARD_DEMO_ENABLED === 'true'
    );
  }
  async bankQr(userId: string, orderId: string) {
    const order = await this.orders.owned(userId, orderId);
    if (
      order.status !== 'PENDING_PAYMENT' ||
      order.inventoryStatus !== 'RESERVED' ||
      order.reservationExpiresAt <= new Date() ||
      order.finalAmount.lte(0)
    )
      throw new ConflictException('Đơn không còn trong thời gian thanh toán.');
    if (order.payments.some((p) => p.status !== 'FAILED' || p.needsReview))
      throw new ConflictException('Đơn đang có giao dịch cần đối soát.');
    return bankQrDetails(order.finalAmount.toFixed(0), order.orderCode);
  }

  async confirmBankTransferDemo(userId: string, orderId: string) {
    return this.confirmDemo(userId, orderId, 'BANK_TRANSFER');
  }
  async failBankTransferDemo(userId: string, orderId: string, body: unknown) {
    if (!this.bankTransferDemoEnabled())
      throw new ForbiddenException('Thanh toán mô phỏng chưa được bật.');
    const input = validateObject(body, ['idempotencyKey']);
    if (!isUuid(orderId) || !isUuid(input.idempotencyKey))
      throw new BadRequestException('Mã yêu cầu không hợp lệ');
    const key = `bank-failure:${userId}:${input.idempotencyKey.toLowerCase()}`;
    return this.prisma.$transaction(async tx => {
      await lockCustomer(tx, userId);
      const order = await this.orders.owned(userId, orderId, tx);
      const previous = await tx.payment.findUnique({ where: { idempotencyKey: key } });
      if (previous) {
        if (previous.orderId !== order.id) throw new ConflictException('Mã yêu cầu đã dùng cho đơn khác');
        return order;
      }
      if (!['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status) ||
          order.inventoryStatus !== 'RESERVED' || order.reservationExpiresAt <= new Date())
        throw new ConflictException('Đơn không còn trong thời gian thanh toán');
      if (order.payments.some(p => p.status !== 'FAILED' || p.needsReview))
        throw new ConflictException('Giao dịch cần đối soát, không thể mô phỏng thất bại');
      if (order.status === 'PAYMENT_FAILED') return order;
      await tx.payment.create({ data: { orderId: order.id, idempotencyKey: key,
        paymentMethod: 'BANK_TRANSFER', amount: order.finalAmount, status: 'FAILED',
        rawResponse: { simulated: true, source: 'customer-demo-failure', confirmedBy: userId } } });
      await tx.order.update({ where: { id: order.id }, data: { status: 'PAYMENT_FAILED' } });
      return this.orders.owned(userId, order.id, tx);
    });
  }

  async retry(userId: string, orderId: string) {
    return this.prisma.$transaction(async tx => {
      await lockCustomer(tx, userId);
      const order = await this.orders.owned(userId, orderId, tx);
      if (!['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status) ||
          order.inventoryStatus !== 'RESERVED' || order.reservationExpiresAt <= new Date())
        throw new ConflictException('Đơn đã hết hạn hoặc không thể thanh toán lại');
      if (order.payments.some(p => p.status !== 'FAILED' || p.needsReview))
        throw new ConflictException('Giao dịch cần đối soát trước khi thử lại');
      await tx.order.update({ where: { id: order.id }, data: { status: 'PENDING_PAYMENT' } });
      return this.orders.owned(userId, order.id, tx);
    });
  }
  async confirmCardDemo(userId: string, orderId: string) {
    return this.confirmDemo(userId, orderId, 'CARD_DEMO');
  }
  private async confirmDemo(
    userId: string,
    orderId: string,
    method: 'BANK_TRANSFER' | 'CARD_DEMO',
  ) {
    if (
      !(method === 'BANK_TRANSFER'
        ? this.bankTransferDemoEnabled()
        : this.cardDemoEnabled())
    )
      throw new ForbiddenException(
        'Xác nhận thanh toán mô phỏng chỉ dùng cho bản demo được bật cấu hình.',
      );
    if (!isUuid(orderId)) throw new BadRequestException('Mã đơn không hợp lệ');
    return this.prisma.$transaction(
      async (tx) => {
        await lockCustomer(tx, userId);
        const order = await this.orders.owned(userId, orderId, tx);
        const idempotencyKey = `${method === 'BANK_TRANSFER' ? 'bank-demo' : 'card-demo'}:${order.id}`;
        const previous = await tx.payment.findUnique({
          where: { idempotencyKey },
        });
        if (previous?.status === 'SUCCESS' && order.status === 'PAID')
          return order;
        if (
          order.status !== 'PENDING_PAYMENT' ||
          order.inventoryStatus !== 'RESERVED' ||
          order.reservationExpiresAt <= new Date()
        )
          throw new ConflictException(
            'Đơn đã hết hạn hoặc không còn chờ thanh toán.',
          );
        if (order.payments.some((p) => p.status !== 'FAILED' || p.needsReview))
          throw new ConflictException(
            'Đơn đang có giao dịch cần đối soát. Không thể xác nhận mô phỏng.',
          );
        const paymentId = randomUUID();
        await tx.payment.create({
          data: {
            id: paymentId,
            orderId: order.id,
            idempotencyKey,
            paymentMethod: method,
            amount: order.finalAmount,
            status: 'SUCCESS',
            transactionId: `DEMO-${paymentId}`,
            rawResponse: {
              simulated: true,
              source:
                method === 'BANK_TRANSFER'
                  ? 'customer-demo-confirmation'
                  : 'test-card-demo',
              confirmedBy: userId,
            },
          },
        });
        await this.orders.markPaid(tx, order.id);
        return this.orders.owned(userId, order.id, tx);
      },
      { timeout: 15000 },
    );
  }
  async orderForPayment(userId: string, id: string) {
    if (!isUuid(id)) throw new BadRequestException('Mã giao dịch không hợp lệ');
    const payment = await this.prisma.payment.findFirst({
      where: { id, order: { userId } },
    });
    if (!payment) throw new NotFoundException('Không tìm thấy giao dịch');
    return this.orders.owned(userId, payment.orderId);
  }

  async create(userId: string, body: unknown, ip: string) {
    const input = validateObject(body, [
      'orderId',
      'idempotencyKey',
      'channel',
    ]);
    if (
      !isUuid(input.orderId) ||
      !isUuid(input.idempotencyKey) ||
      (input.channel !== 'card' && input.channel !== 'zalopay')
    )
      throw new BadRequestException('Yêu cầu thanh toán không hợp lệ');
    const orderId = input.orderId.toLowerCase();
    if (input.channel === 'zalopay') return this.zalopay.create(userId, orderId, input.idempotencyKey.toLowerCase());
    const idempotencyKey = `${userId}:${input.idempotencyKey.toLowerCase()}`;
    return this.prisma.$transaction(async (tx) => {
      await lockCustomer(tx, userId);
      const order = await this.orders.owned(userId, orderId, tx);
      const previous = await tx.payment.findUnique({
        where: { idempotencyKey },
      });
      if (previous) {
        if (previous.orderId !== orderId)
          throw new ConflictException(
            'Mã yêu cầu đã được sử dụng cho đơn khác',
          );
        return {
          id: previous.id,
          status: previous.status,
          paymentUrl:
            previous.status === 'PENDING' ? previous.paymentUrl : null,
          orderId,
        };
      }
      if (
        order.status !== 'PENDING_PAYMENT' ||
        order.inventoryStatus !== 'RESERVED' ||
        order.reservationExpiresAt <= new Date()
      )
        throw new ConflictException('Đơn không còn trong thời gian thanh toán');
      const pending = await tx.payment.findFirst({
        where: { orderId, status: 'PENDING' },
      });
      if (pending && pending.paymentMethod !== 'VNPAY')
        throw new ConflictException('Đơn đang có giao dịch tại ZaloPay. Hãy kiểm tra kết quả trước.');
      if (pending)
        return {
          id: pending.id,
          status: pending.status,
          paymentUrl: pending.paymentUrl,
          orderId,
        };
      if (order.payments.some((p) => p.needsReview || p.status === 'SUCCESS'))
        throw new ConflictException('Đơn đang cần đối soát');
      if (order.finalAmount.lt(5000) || order.finalAmount.gt(9999999999))
        throw new BadRequestException(
          'Số tiền không thuộc giới hạn thanh toán VNPay (từ 5.000đ)',
        );
      const id = randomUUID();
      const createdAt = new Date();
      const paymentUrl = this.gateway.url(
        id,
        order.finalAmount.times(100).toFixed(0),
        createdAt,
        order.reservationExpiresAt,
        ip,
        String(input.channel),
      );
      await tx.payment.create({
        data: {
          id,
          orderId,
          idempotencyKey,
          amount: order.finalAmount,
          paymentMethod: 'VNPAY',
          paymentUrl,
          createdAt,
        },
      });
      return { id, status: 'PENDING', paymentUrl, orderId };
    });
  }

  async publicReturn(body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Kết quả VNPay không hợp lệ');
    const params = this.gateway.verify(body as Record<string, unknown>);
    if (!params || !isUuid(params.vnp_TxnRef))
      throw new BadRequestException('Chữ ký hoặc mã giao dịch VNPay không hợp lệ');
    const payment = await this.prisma.payment.findUnique({
      where: { id: params.vnp_TxnRef }, include: { order: true },
    });
    if (!payment || payment.paymentMethod !== 'VNPAY')
      throw new NotFoundException('Không tìm thấy giao dịch VNPay');
    const order = await this.handleReturn(payment.order.userId, body);
    const current = order.payments.find(p => p.id === payment.id)!;
    // Signed receipt only. Personal details remain behind the owned-order API.
    return { orderId: order.id, status: order.status,
      paymentStatus: current.status, needsReview: current.needsReview };
  }

  async handleReturn(userId: string, body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body))
      throw new BadRequestException('Kết quả VNPay không hợp lệ');
    const params = this.gateway.verify(body as Record<string, unknown>);
    if (!params) throw new BadRequestException('Chữ ký VNPay không hợp lệ');
    const order = await this.orderForPayment(userId, params.vnp_TxnRef);
    // The browser is only a carrier: verify the merchant signature first, then
    // use the same amount/reference/idempotency checks as the IPN handler.
    const success = params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00';
    const cancelled = params.vnp_ResponseCode === '24' &&
      (!params.vnp_TransactionStatus || params.vnp_TransactionStatus === '02');
    if (success || cancelled) {
      const result = await this.applyVerified(cancelled
        ? { ...params, vnp_TransactionStatus: '02' } : params);
      if (!['00', '02'].includes(result.RspCode))
        throw new BadRequestException('Kết quả VNPay không khớp giao dịch');
      return this.orders.owned(userId, order.id);
    }
    return this.reconcile(userId, order.id);
  }

  async notification(query: Record<string, unknown>) {
    const params = this.gateway.verify(query);
    if (!params) return { RspCode: '97', Message: 'Invalid signature' };
    return this.applyVerified(params);
  }

  private async applyVerified(params: Record<string, string>) {
    if (!isUuid(params.vnp_TxnRef) || !/^\d+$/.test(params.vnp_Amount ?? ''))
      return { RspCode: '01', Message: 'Invalid reference' };
    const payment = await this.prisma.payment.findUnique({
      where: { id: params.vnp_TxnRef },
      include: { order: true },
    });
    if (!payment || payment.paymentMethod !== 'VNPAY')
      return { RspCode: '01', Message: 'Not found' };
    if (!payment.amount.times(100).eq(params.vnp_Amount))
      return { RspCode: '04', Message: 'Invalid amount' };
    const success =
      params.vnp_ResponseCode === '00' && params.vnp_TransactionStatus === '00';
    // Only definitive terminal failures release the ability to retry/cancel. Other states remain pending.
    const failed = ['02', '08'].includes(params.vnp_TransactionStatus);
    if (success && !/^[1-9]\d{0,14}$/.test(params.vnp_TransactionNo ?? ''))
      return { RspCode: '99', Message: 'Missing transaction number' };
    return this.prisma.$transaction(
      async (tx) => {
        await lockCustomer(tx, payment.order.userId);
        const current = await tx.payment.findUniqueOrThrow({
          where: { id: payment.id },
        });
        const order = await tx.order.findUniqueOrThrow({
          where: { id: payment.orderId },
        });
        if (current.status === 'SUCCESS')
          return { RspCode: '02', Message: 'Already processed' };
        if (success) {
          const late =
            !['PENDING_PAYMENT', 'PAYMENT_FAILED'].includes(order.status) ||
            order.inventoryStatus !== 'RESERVED';
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'SUCCESS',
              transactionId: params.vnp_TransactionNo,
              needsReview: late,
              rawResponse: params as Prisma.InputJsonValue,
            },
          });
          if (!late) await this.orders.markPaid(tx, order.id);
        } else if (failed && current.status === 'PENDING') {
          await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: 'FAILED',
              rawResponse: params as Prisma.InputJsonValue,
            },
          });
          if (order.status === 'PENDING_PAYMENT' && order.inventoryStatus === 'RESERVED')
            await tx.order.update({ where: { id: order.id }, data: { status: 'PAYMENT_FAILED' } });
        }
        return { RspCode: '00', Message: 'Confirmed' };
      },
      { timeout: 15000 },
    );
  }

  async reconcile(userId: string, orderId: string) {
    const order = await this.orders.owned(userId, orderId);
    await this.zalopay.reconcile(userId, orderId);
    const payments = await this.prisma.payment.findMany({
      where: { orderId, status: 'PENDING', paymentMethod: 'VNPAY' },
    });
    // Network work stays outside the database transaction. IPN can settle concurrently.
    for (const payment of payments) {
      const result = await this.gateway.query(payment.id, payment.createdAt);
      const applied = await this.applyVerified(result);
      if (!['00', '02'].includes(applied.RspCode))
        throw new ConflictException('Kết quả đối soát không khớp giao dịch');
    }
    if (order.reservationExpiresAt <= new Date()) {
      try {
        await this.orders.cancel(userId, orderId, true);
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
      }
    }
    return this.orders.owned(userId, orderId);
  }

  async cancel(userId: string, orderId: string) {
    const initial = await this.orders.owned(userId, orderId);
    if (['CANCELLED', 'EXPIRED'].includes(initial.status)) return initial;
    if (initial.status === 'PAID') throw new ConflictException('Đơn đã thanh toán không thể hủy.');
    await this.zalopay.cancelPending(userId, orderId);
    const order = await this.reconcile(userId, orderId);
    if (['PAID', 'EXPIRED', 'CANCELLED'].includes(order.status)) return order;
    return this.orders.cancel(userId, orderId, order.reservationExpiresAt <= new Date());
  }

  async expireOrders() {
    if (this.running) return;
    this.running = true;
    try {
      const orders = await this.prisma.order.findMany({
        where: {
          status: { in: ['PENDING_PAYMENT', 'PAYMENT_FAILED'] },
          OR: [
            { reservationExpiresAt: { lt: new Date() } },
            { payments: { some: { paymentMethod: 'ZALOPAY', status: 'PENDING' } } },
          ],
        },
        take: 50,
        orderBy: { reservationExpiresAt: 'asc' },
      });
      for (let offset = 0; offset < orders.length; offset += 4) {
        await Promise.all(orders.slice(offset, offset + 4).map(async order => {
          try {
            await this.reconcile(order.userId, order.id);
          } catch {
            this.logger.warn(`Order ${order.id} remains pending reconciliation`);
          }
        }));
      }
    } catch {
      this.logger.warn('Could not reconcile expired orders');
    } finally {
      this.running = false;
    }
  }
}
