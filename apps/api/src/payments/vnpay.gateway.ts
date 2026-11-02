import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

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
  verify(input: Record<string, unknown>): Record<string, string> | null {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(input)) {
      if (!key.startsWith('vnp_') || typeof value !== 'string') return null;
      if (!['vnp_SecureHash', 'vnp_SecureHashType'].includes(key))
        params[key] = value;
    }
    return params.vnp_TmnCode === this.config().merchant &&
      this.matches(queryString(params), String(input.vnp_SecureHash ?? ''))
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
    if (channel === 'card') params.vnp_BankCode = 'VNBANK';
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
      vnp_IpAddr: '127.0.0.1',
      vnp_OrderInfo: `Kiem tra BrewLite ${id}`,
    };
    data.vnp_SecureHash = this.sign(Object.values(data).join('|'));
    const response = await fetch(
      'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok)
      throw new ServiceUnavailableException(
        'Chưa kết nối được VNPay để đối soát',
      );
    const result = (await response.json()) as Record<string, string>;
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
      !this.matches(
        fields.map((key) => result[key] ?? '').join('|'),
        result.vnp_SecureHash ?? '',
      ) ||
      result.vnp_TmnCode !== this.config().merchant ||
      result.vnp_TxnRef !== id ||
      result.vnp_Command !== 'querydr' ||
      result.vnp_ResponseCode !== '00'
    )
      throw new ServiceUnavailableException(
        'VNPay chưa trả kết quả đối soát hợp lệ; giao dịch tiếp tục chờ xác nhận',
      );
    return result;
  }
}
