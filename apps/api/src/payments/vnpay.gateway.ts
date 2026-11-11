import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export class VnpayGatewayError extends ServiceUnavailableException {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super({ message, code });
  }
}

export function unverifiedVnpayResult(result: Record<string, unknown>) {
  const value = result.vnp_ResponseCode;
  const code =
    typeof value === 'string' && /^\d{2}$/.test(value) ? value : null;
  return new VnpayGatewayError(
    code ? `VNPAY_UNVERIFIED_${code}` : 'VNPAY_INVALID_RESPONSE',
    code === '99'
      ? 'VNPay sandbox trả lỗi 99; chưa xác minh được kết quả. Vui lòng liên hệ quán để đối soát.'
      : 'Kết quả VNPay chưa xác minh được; giao dịch tiếp tục chờ đối soát.',
  );
}

export function vnpDate(date: Date) {
  return new Date(date.getTime() + 7 * 3600000)
    .toISOString()
    .replace(/[-:T]/g, '')
    .slice(0, 14);
}
export function queryString(params: Record<string, string>) {
  const encode = (value: string) =>
    encodeURIComponent(value).replace(/%20/g, '+');
  return Object.keys(params)
    .sort()
    .map((key) => `${encode(key)}=${encode(params[key])}`)
    .join('&');
}
@Injectable()
export class VnpayGateway {
  configured() {
    return Boolean(process.env.VNPAY_TMN_CODE && process.env.VNPAY_HASH_SECRET);
  }
  private config() {
    if (!this.configured())
      throw new ServiceUnavailableException(
        'VNPay sandbox chưa được cấu hình. Vui lòng liên hệ quản trị',
      );
    return {
      merchant: process.env.VNPAY_TMN_CODE!,
      secret: process.env.VNPAY_HASH_SECRET!,
    };
  }
  sign(data: string) {
    return createHmac('sha512', this.config().secret)
      .update(data, 'utf8')
      .digest('hex');
  }
  matches(data: string, hash: string) {
    if (!/^[a-f0-9]{128}$/i.test(hash)) return false;
    return timingSafeEqual(
      Buffer.from(this.sign(data), 'hex'),
      Buffer.from(hash, 'hex'),
    );
  }
  async transaction(data: Record<string, string>, timeout = 10000) {
    let response: Response;
    try {
      response = await fetch(
        'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          signal: AbortSignal.timeout(timeout),
        },
      );
    } catch (error) {
      const timedOut = error instanceof Error && error.name === 'TimeoutError';
      throw new VnpayGatewayError(
        timedOut ? 'VNPAY_TIMEOUT' : 'VNPAY_NETWORK_ERROR',
        timedOut
          ? 'Kết nối VNPay quá thời gian chờ; kết quả giao dịch chưa được xác định.'
          : 'Chưa kết nối được VNPay; kết quả giao dịch chưa được xác định.',
      );
    }
    if (!response.ok)
      throw new VnpayGatewayError(
        'VNPAY_HTTP_ERROR',
        'API VNPay tạm thời chưa trả kết quả hợp lệ.',
      );
    let result: unknown;
    try {
      result = await response.json();
    } catch {
      throw new VnpayGatewayError(
        'VNPAY_INVALID_RESPONSE',
        'Phản hồi VNPay chưa xác minh được.',
      );
    }
    if (!result || typeof result !== 'object' || Array.isArray(result))
      throw new VnpayGatewayError(
        'VNPAY_INVALID_RESPONSE',
        'Phản hồi VNPay chưa xác minh được.',
      );
    return result as Record<string, unknown>;
  }
  verify(input: Record<string, unknown>): Record<string, string> | null {
    if (typeof input.vnp_SecureHash !== 'string') return null;
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      if (!key.startsWith('vnp_') || typeof value !== 'string') return null;
      if (!['vnp_SecureHash', 'vnp_SecureHashType'].includes(key))
        params[key] = value;
    }
    return params.vnp_TmnCode === this.config().merchant &&
      this.matches(queryString(params), input.vnp_SecureHash)
      ? params
      : null;
  }
  url(
    id: string,
    amount: string,
    createdAt: Date,
    expiresAt: Date,
    ip: string,
    channel: string,
  ) {
    const params: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.config().merchant,
      vnp_Amount: amount,
      vnp_CurrCode: 'VND',
      vnp_TxnRef: id,
      vnp_OrderInfo: `Thanh toan BrewLite ${id}`,
      vnp_OrderType: 'other',
      vnp_Locale: 'vn',
      vnp_CreateDate: vnpDate(createdAt),
      vnp_ExpireDate: vnpDate(expiresAt),
      vnp_IpAddr:
        ip.replace(/^::ffff:/, '') === '::1'
          ? '127.0.0.1'
          : ip.replace(/^::ffff:/, ''),
      vnp_ReturnUrl:
        process.env.VNPAY_RETURN_URL || 'http://localhost:5173/payments/return',
    };
    if (channel !== 'card')
      throw new ServiceUnavailableException('VNPay chỉ hỗ trợ thẻ nội địa.');
    params.vnp_BankCode = 'VNBANK';
    const query = queryString(params);
    return `https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?${query}&vnp_SecureHash=${this.sign(query)}`;
  }
  async query(id: string, createdAt: Date) {
    const data: Record<string, string> = {
      vnp_RequestId: randomUUID().replaceAll('-', ''),
      vnp_Version: '2.1.0',
      vnp_Command: 'querydr',
      vnp_TmnCode: this.config().merchant,
      vnp_TxnRef: id,
      vnp_TransactionDate: vnpDate(createdAt),
      vnp_CreateDate: vnpDate(new Date()),
      vnp_IpAddr: process.env.VNPAY_API_IP || '127.0.0.1',
      vnp_OrderInfo: `Kiem tra BrewLite ${id}`,
    };
    data.vnp_SecureHash = this.sign(Object.values(data).join('|'));
    const result = await this.transaction(data);
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
      'vnp_PromotionCode',
      'vnp_PromotionAmount',
    ];
    if (
      typeof result.vnp_SecureHash !== 'string' ||
      !fields.every(
        (key) => result[key] === undefined || typeof result[key] === 'string',
      ) ||
      !this.matches(
        fields
          .map((key) => (typeof result[key] === 'string' ? result[key] : ''))
          .join('|'),
        result.vnp_SecureHash,
      ) ||
      result.vnp_TmnCode !== this.config().merchant ||
      result.vnp_TxnRef !== id ||
      result.vnp_Command !== 'querydr' ||
      result.vnp_ResponseCode !== '00'
    )
      throw unverifiedVnpayResult(result);
    return result as Record<string, string>;
  }
}
