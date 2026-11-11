import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { VnpayGateway, vnpDate } from './vnpay.gateway.js';
import { zalopayMac } from './zalopay.gateway.js';

export type RefundResult = {
  state: 'PENDING' | 'SUCCESS' | 'FAILED';
  providerRefundId?: string;
  code: string;
};
export type RefundRequest = {
  providerReference: string;
  amount: string;
  requestedById: string;
  createdAt: Date;
  payment: {
    id: string;
    paymentMethod: string;
    transactionId: string | null;
    createdAt: Date;
  };
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid gateway response');
  return value as Record<string, unknown>;
}
function identifier(value: unknown): string | undefined {
  if (typeof value === 'string' && /^[1-9]\d{0,24}$/.test(value)) return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0)
    return String(value);
  return undefined;
}

@Injectable()
export class RefundGateway {
  constructor(private readonly vnpay: VnpayGateway) {}

  assertConfigured(method: string) {
    if (method === 'VNPAY' && this.vnpay.configured()) return;
    if (
      method === 'ZALOPAY' &&
      /^\d{1,5}$/.test(process.env.ZALOPAY_APP_ID ?? '') &&
      process.env.ZALOPAY_KEY1
    )
      return;
    throw new ServiceUnavailableException('Chưa cấu hình cổng hoàn tiền.');
  }

  reference(id: string, method: string, date: Date) {
    if (method === 'ZALOPAY') {
      const appId = process.env.ZALOPAY_APP_ID ?? '';
      if (!/^\d{1,5}$/.test(appId))
        throw new ServiceUnavailableException(
          'Chưa cấu hình ZaloPay để hoàn tiền.',
        );
      return `${vnpDate(date).slice(2, 8)}_${appId}_${id.replaceAll('-', '')}`;
    }
    return id.replaceAll('-', '');
  }
  private async post(url: string, data: Record<string, unknown>) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Chưa xác định được kết quả hoàn tiền.',
      );
    return record(await response.json());
  }
  async submit(request: RefundRequest): Promise<RefundResult> {
    if (request.payment.paymentMethod === 'ZALOPAY') {
      const appId = process.env.ZALOPAY_APP_ID!;
      const key = process.env.ZALOPAY_KEY1;
      if (!key || !request.payment.transactionId)
        throw new ServiceUnavailableException(
          'Thiếu cấu hình hoặc mã giao dịch ZaloPay.',
        );
      const timestamp = Date.now();
      const description = 'Hoan tien don BrewLite';
      const data = await this.post('https://sb-openapi.zalopay.vn/v2/refund', {
        app_id: Number(appId),
        m_refund_id: request.providerReference,
        zp_trans_id: request.payment.transactionId,
        amount: Number(request.amount),
        timestamp,
        description,
        mac: zalopayMac(
          [
            appId,
            request.payment.transactionId,
            request.amount,
            description,
            timestamp,
          ].join('|'),
          key,
        ),
      });
      // A refund accepted into a queue is not yet a completed refund.
      if (data.return_code === 1) return this.zaloResult(data, true);
      const definitive =
        data.return_code === 2 &&
        [-14, -13, -101, -401, -402, -32].includes(
          Number(data.sub_return_code),
        );
      return {
        state: definitive ? 'FAILED' : 'PENDING',
        code: `ZALO:${String(data.return_code)}:${String(data.sub_return_code)}`,
      };
    }
    if (request.payment.paymentMethod !== 'VNPAY')
      throw new ServiceUnavailableException(
        'Phương thức này không hỗ trợ hoàn tiền qua cổng.',
      );
    const data: Record<string, string> = {
      vnp_RequestId: request.providerReference,
      vnp_Version: '2.1.0',
      vnp_Command: 'refund',
      vnp_TmnCode: process.env.VNPAY_TMN_CODE ?? '',
      vnp_TransactionType: '02',
      vnp_TxnRef: request.payment.id,
      vnp_Amount: (BigInt(request.amount) * 100n).toString(),
      vnp_TransactionNo: request.payment.transactionId ?? '',
      vnp_TransactionDate: vnpDate(request.payment.createdAt),
      vnp_CreateBy: request.requestedById,
      vnp_CreateDate: vnpDate(new Date()),
      vnp_IpAddr: process.env.VNPAY_API_IP || '127.0.0.1',
      vnp_OrderInfo: 'Hoan tien don BrewLite',
    };
    data.vnp_SecureHash = this.vnpay.sign(Object.values(data).join('|'));
    const response = await this.post(
      'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
      data,
    );
    const fields = [
      'vnp_ResponseId',
      'vnp_Command',
      'vnp_ResponseCode',
      'vnp_Message',
      'vnp_TmnCode',
      'vnp_TxnRef',
      'vnp_Amount',
      'vnp_BankCode',
      'vnp_PayDate',
      'vnp_TransactionNo',
      'vnp_TransactionType',
      'vnp_TransactionStatus',
      'vnp_OrderInfo',
    ];
    if (
      typeof response.vnp_SecureHash !== 'string' ||
      !fields.every(
        (key) =>
          response[key] === undefined || typeof response[key] === 'string',
      ) ||
      !this.vnpay.matches(
        fields
          .map((key) =>
            typeof response[key] === 'string' ? response[key] : '',
          )
          .join('|'),
        response.vnp_SecureHash,
      ) ||
      response.vnp_Command !== 'refund' ||
      response.vnp_TmnCode !== data.vnp_TmnCode ||
      response.vnp_TxnRef !== request.payment.id ||
      String(response.vnp_Amount) !== data.vnp_Amount
    )
      throw new ServiceUnavailableException(
        'Kết quả hoàn tiền VNPay chưa xác minh được.',
      );
    return this.vnpayResult(response, true);
  }
  async query(request: RefundRequest): Promise<RefundResult> {
    if (request.payment.paymentMethod === 'ZALOPAY') {
      const appId = process.env.ZALOPAY_APP_ID!;
      const key = process.env.ZALOPAY_KEY1;
      if (!key)
        throw new ServiceUnavailableException(
          'Chưa cấu hình hoàn tiền ZaloPay.',
        );
      const timestamp = Date.now();
      const data = await this.post(
        'https://sb-openapi.zalopay.vn/v2/query_refund',
        {
          app_id: Number(appId),
          m_refund_id: request.providerReference,
          timestamp,
          mac: zalopayMac(
            `${appId}|${request.providerReference}|${timestamp}`,
            key,
          ),
        },
      );
      return this.zaloResult(data);
    }
    const data = await this.vnpay.query(
      request.payment.id,
      request.payment.createdAt,
    );
    if (data.vnp_Amount !== (BigInt(request.amount) * 100n).toString())
      throw new ServiceUnavailableException(
        'Số tiền đối soát hoàn tiền VNPay không khớp.',
      );
    return this.vnpayResult(data, false);
  }
  private vnpayResult(
    data: Record<string, unknown>,
    submitted: boolean,
  ): RefundResult {
    const refund = data.vnp_TransactionType === '02';
    const id = identifier(data.vnp_TransactionNo);
    const success =
      refund &&
      data.vnp_ResponseCode === '00' &&
      data.vnp_TransactionStatus === '00' &&
      id;
    const failed =
      (refund && data.vnp_TransactionStatus === '09') ||
      (submitted &&
        ['02', '03', '91', '95', '97'].includes(String(data.vnp_ResponseCode)));
    return {
      state: success ? 'SUCCESS' : failed ? 'FAILED' : 'PENDING',
      providerRefundId: success ? id : undefined,
      code: `VNPAY:${String(data.vnp_ResponseCode)}:${String(data.vnp_TransactionStatus)}`,
    };
  }
  private zaloResult(
    data: Record<string, unknown>,
    submitted = false,
  ): RefundResult {
    const id = identifier(data.refund_id);
    // The v2 API uses return_code; some integrations also return refund_status.
    const success =
      data.return_code === 1 &&
      (data.refund_status === 1 ||
        (!submitted && data.refund_status === undefined));
    const failed =
      data.return_code === 2 &&
      (data.refund_status === 2 ||
        [-2, -13, -14, -32].includes(Number(data.sub_return_code)));
    return {
      state: success ? 'SUCCESS' : failed ? 'FAILED' : 'PENDING',
      providerRefundId: id,
      code: `ZALO:${String(data.return_code)}:${String(data.sub_return_code)}`,
    };
  }
}
