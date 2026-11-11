import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

const endpoint = 'https://sb-openapi.zalopay.vn/v2';
export function zalopayMac(data: string, key: string) {
  return createHmac('sha256', key).update(data, 'utf8').digest('hex');
}
export function zalopayReference(id: string, createdAt: Date) {
  const date = new Date(createdAt.getTime() + 7 * 3600000)
    .toISOString()
    .slice(2, 10)
    .replaceAll('-', '');
  return `${date}_${id.replaceAll('-', '')}`;
}
export function zalopayPaymentId(reference: string) {
  if (!/^\d{6}_[a-f0-9]{32}$/.test(reference)) return null;
  const id = reference.slice(7);
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
function integer(value: unknown): string | null {
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? String(value)
    : null;
}
function validUrl(value: string | undefined, publicOnly = false) {
  try {
    const url = new URL(value ?? '');
    return (
      !url.username &&
      !url.password &&
      !url.hash &&
      !url.search &&
      (publicOnly
        ? url.protocol === 'https:' &&
          !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
        : ['http:', 'https:'].includes(url.protocol))
    );
  } catch {
    return false;
  }
}
export type ZalopayResult = {
  state: 'SUCCESS' | 'FAILED' | 'PENDING';
  amount: string | null;
  transactionId: string | null;
  code: number;
  subCode: number;
};

@Injectable()
export class ZalopayGateway {
  configured() {
    return Boolean(
      /^\d+$/.test(process.env.ZALOPAY_APP_ID ?? '') &&
      process.env.ZALOPAY_KEY1?.trim() &&
      process.env.ZALOPAY_KEY2?.trim() &&
      validUrl(process.env.ZALOPAY_RETURN_URL) &&
      (!process.env.ZALOPAY_CALLBACK_URL ||
        validUrl(process.env.ZALOPAY_CALLBACK_URL, true)),
    );
  }
  assertConfigured() {
    if (!this.configured())
      throw new ServiceUnavailableException(
        'ZaloPay sandbox chưa được cấu hình App ID, Key1, Key2 và Return URL.',
      );
  }
  private config() {
    this.assertConfigured();
    return {
      appId: process.env.ZALOPAY_APP_ID!,
      key1: process.env.ZALOPAY_KEY1!.trim(),
      key2: process.env.ZALOPAY_KEY2!.trim(),
    };
  }
  private matches(data: string, mac: unknown) {
    return (
      typeof mac === 'string' &&
      /^[a-f0-9]{64}$/i.test(mac) &&
      timingSafeEqual(
        Buffer.from(zalopayMac(data, this.config().key2), 'hex'),
        Buffer.from(mac, 'hex'),
      )
    );
  }
  private async post(path: string, body: Record<string, unknown>) {
    try {
      const response = await fetch(`${endpoint}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('HTTP error');
      const data = object(await response.json());
      if (!data || !Number.isSafeInteger(data.return_code))
        throw new Error('Invalid response');
      return data;
    } catch {
      throw new ServiceUnavailableException(
        'Chưa xác định được kết quả ZaloPay. Vui lòng kiểm tra trạng thái đơn, không thanh toán thêm lần nữa.',
      );
    }
  }
  async create(
    reference: string,
    amount: number,
    userId: string,
    description: string,
    expiresAt: Date,
  ) {
    const { appId, key1 } = this.config();
    const remaining = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
    if (remaining < 300)
      throw new ServiceUnavailableException(
        'ZaloPay cần ít nhất 5 phút còn lại để tạo QR. Hãy hủy đơn và đặt lại.',
      );
    const body = {
      app_id: Number(appId),
      app_trans_id: reference,
      app_user: userId,
      app_time: Date.now(),
      amount,
      description,
      item: '[]',
      embed_data: JSON.stringify({
        redirecturl: process.env.ZALOPAY_RETURN_URL,
        preferred_payment_method: ['zalopay_wallet'],
      }),
      bank_code: '',
      expire_duration_seconds: remaining,
      ...(process.env.ZALOPAY_CALLBACK_URL
        ? { callback_url: process.env.ZALOPAY_CALLBACK_URL }
        : {}),
    };
    const mac = zalopayMac(
      [
        appId,
        reference,
        userId,
        amount,
        body.app_time,
        body.embed_data,
        body.item,
      ].join('|'),
      key1,
    );
    const result = await this.post('create', { ...body, mac });
    const subCode =
      typeof result.sub_return_code === 'number' ? result.sub_return_code : 0;
    if (result.return_code !== 1)
      return {
        paymentUrl: null,
        rejected:
          result.return_code === 2 &&
          [-401, -402, -429, -500, -999].includes(subCode),
        code: subCode,
      };
    if (typeof result.order_url !== 'string')
      throw new ServiceUnavailableException(
        'ZaloPay chưa trả URL thanh toán hợp lệ.',
      );
    const url = new URL(result.order_url);
    if (
      url.protocol !== 'https:' ||
      !['sbgateway.zalopay.vn', 'qcgateway.zalopay.vn'].includes(
        url.hostname,
      ) ||
      url.port ||
      url.username ||
      url.password
    )
      throw new ServiceUnavailableException(
        'URL thanh toán không thuộc ZaloPay sandbox.',
      );
    return { paymentUrl: url.href, rejected: false, code: 1 };
  }
  verifyCallback(body: unknown) {
    const input = object(body);
    if (
      !input ||
      input.type !== 1 ||
      typeof input.data !== 'string' ||
      !this.matches(input.data, input.mac)
    )
      return null;
    let data: Record<string, unknown> | null;
    try {
      data = object(JSON.parse(input.data));
    } catch {
      return null;
    }
    if (
      !data ||
      String(data.app_id) !== this.config().appId ||
      typeof data.app_trans_id !== 'string' ||
      !zalopayPaymentId(data.app_trans_id)
    )
      return null;
    return {
      reference: data.app_trans_id,
      amount: integer(data.amount),
      transactionId: integer(data.zp_trans_id),
    };
  }
  verifyRedirect(body: unknown) {
    const input = object(body);
    const fields = [
      'appid',
      'apptransid',
      'pmcid',
      'bankcode',
      'amount',
      'discountamount',
      'status',
    ];
    if (
      !input ||
      !fields.every((key) => typeof input[key] === 'string') ||
      input.appid !== this.config().appId ||
      !this.matches(fields.map((key) => input[key]).join('|'), input.checksum)
    )
      return null;
    if (!zalopayPaymentId(input.apptransid as string)) return null;
    return {
      reference: input.apptransid as string,
      amount: integer(input.amount),
    };
  }
  async query(reference: string): Promise<ZalopayResult> {
    const { appId, key1 } = this.config();
    const mac = zalopayMac(`${appId}|${reference}|${key1}`, key1);
    const result = await this.post('query', {
      app_id: Number(appId),
      app_trans_id: reference,
      mac,
    });
    const code = result.return_code as number;
    const subCode =
      typeof result.sub_return_code === 'number' ? result.sub_return_code : 0;
    // Query errors and insufficient balance do not mean the QR can no longer be paid.
    const state =
      code === 1
        ? 'SUCCESS'
        : code === 4 || (code === 2 && subCode === -54)
          ? 'FAILED'
          : 'PENDING';
    return {
      state,
      amount: integer(result.amount),
      transactionId: integer(result.zp_trans_id),
      code,
      subCode,
    };
  }
  async cancel(reference: string) {
    const { appId, key1 } = this.config();
    const result = await this.post('cancel', {
      app_id: Number(appId),
      app_trans_id: reference,
      mac: zalopayMac(`${appId}|${reference}|${key1}`, key1),
    });
    return {
      cancelled: result.return_code === 1,
      code: result.return_code as number,
      subCode:
        typeof result.sub_return_code === 'number' ? result.sub_return_code : 0,
    };
  }
}
