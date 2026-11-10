import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ZalopayGateway,
  zalopayPaymentId,
  zalopayReference,
} from './zalopay.gateway.js';
import {
  testZaloCallback,
  testZaloRedirect,
} from '../../test/zalopay-fixture.js';

describe('ZaloPay sandbox gateway', () => {
  const gateway = new ZalopayGateway();
  const reference = '261110_11111111111141118111111111111111';
  beforeEach(() => {
    vi.stubEnv('ZALOPAY_APP_ID', '1234');
    vi.stubEnv('ZALOPAY_KEY1', 'test-key1');
    vi.stubEnv('ZALOPAY_KEY2', 'test-key2');
    vi.stubEnv(
      'ZALOPAY_RETURN_URL',
      'http://localhost:5173/payments/zalopay/return',
    );
    vi.stubEnv('ZALOPAY_CALLBACK_URL', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it('supports local queries without callback but rejects malformed callback URLs and absent keys', () => {
    expect(gateway.configured()).toBe(true);
    vi.stubEnv('ZALOPAY_CALLBACK_URL', 'http://localhost:3000/callback');
    expect(gateway.configured()).toBe(false);
    vi.stubEnv('ZALOPAY_CALLBACK_URL', '');
    vi.stubEnv('ZALOPAY_KEY1', '');
    expect(gateway.configured()).toBe(false);
  });
  it('uses the Vietnam date across UTC midnight and round-trips an immutable 39-character reference', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    expect(zalopayReference(id, new Date('2026-11-09T18:00:00Z'))).toBe(
      reference,
    );
    expect(reference).toHaveLength(39);
    expect(zalopayPaymentId(reference)).toBe(id);
    expect(zalopayPaymentId('invalid')).toBeNull();
  });
  it('signs a sandbox-only wallet request and keeps keys out of the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          return_code: 1,
          order_url: 'https://qcgateway.zalopay.vn/openinapp?order=test',
        }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const result = await gateway.create(
      reference,
      50000,
      'customer-test',
      'BrewLite',
      new Date(Date.now() + 600000),
    );
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(options.body as string) as Record<
      string,
      string | number
    >;
    expect(url).toBe('https://sb-openapi.zalopay.vn/v2/create');
    expect(body.amount).toBe(50000);
    expect(JSON.parse(String(body.embed_data))).toEqual({
      redirecturl: 'http://localhost:5173/payments/zalopay/return',
      preferred_payment_method: ['zalopay_wallet'],
    });
    expect(body.mac).toBe(
      createHmac('sha256', 'test-key1')
        .update(
          [
            1234,
            reference,
            'customer-test',
            50000,
            body.app_time,
            body.embed_data,
            body.item,
          ].join('|'),
        )
        .digest('hex'),
    );
    expect(body).not.toHaveProperty('key1');
    expect(body).not.toHaveProperty('callback_url');
    expect(result.paymentUrl).toContain('qcgateway.zalopay.vn');
  });
  it('rejects production checkout URLs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            return_code: 1,
            order_url: 'https://gateway.zalopay.vn/pay',
          }),
        ),
      ),
    );
    await expect(
      gateway.create(
        reference,
        50000,
        'test',
        'BrewLite',
        new Date(Date.now() + 600000),
      ),
    ).rejects.toThrow('sandbox');
  });
  it('does not create a QR with less than five minutes remaining', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      gateway.create(
        reference,
        50000,
        'test',
        'BrewLite',
        new Date(Date.now() + 10000),
      ),
    ).rejects.toThrow('5 phút');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('validates callback MAC over the original JSON string, merchant, type and reference', () => {
    const callback = testZaloCallback(reference);
    expect(gateway.verifyCallback(callback)?.amount).toBe('50000');
    expect(
      gateway.verifyCallback({
        ...callback,
        data: callback.data.replace('50000', '1'),
      }),
    ).toBeNull();
    expect(gateway.verifyCallback({ ...callback, type: 2 })).toBeNull();
    expect(
      gateway.verifyCallback(testZaloCallback(reference, { app_id: 9999 })),
    ).toBeNull();
    expect(
      gateway.verifyCallback({ data: '{}', mac: 'bad', type: 1 }),
    ).toBeNull();
  });
  it('verifies signed redirects without trusting the browser status', () => {
    const redirect = testZaloRedirect(reference);
    expect(gateway.verifyRedirect(redirect)?.reference).toBe(reference);
    expect(gateway.verifyRedirect({ ...redirect, status: '2' })).toBeNull();
    expect(gateway.verifyRedirect({ ...redirect, checksum: 'x' })).toBeNull();
  });
  it.each([
    [1, 1, false, 'SUCCESS'],
    [3, 0, true, 'PENDING'],
    [2, -54, false, 'FAILED'],
    [2, -54, true, 'FAILED'],
    [2, -54, undefined, 'FAILED'],
    [2, -54, 0, 'FAILED'],
    [4, 0, false, 'FAILED'],
    [2, -63, false, 'PENDING'],
    [2, -402, false, 'PENDING'],
    [2, -101, false, 'PENDING'],
  ])(
    'classifies query code %s / %s without treating technical errors as payment failure',
    async (code, subCode, processing, state) => {
      const fetchMock = vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            return_code: code,
            sub_return_code: subCode,
            is_processing: processing,
            amount: 50000,
            zp_trans_id: '123456',
          }),
        ),
      );
      vi.stubGlobal('fetch', fetchMock);
      expect((await gateway.query(reference)).state).toBe(state);
      const body = JSON.parse(
        (fetchMock.mock.calls[0][1] as RequestInit).body as string,
      ) as Record<string, unknown>;
      expect(body.mac).toBe(
        createHmac('sha256', 'test-key1')
          .update(`1234|${reference}|test-key1`)
          .digest('hex'),
      );
    },
  );
  it('keeps duplicate create references uncertain for querying', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ return_code: 2, sub_return_code: -68 }),
          ),
        ),
    );
    expect(
      await gateway.create(
        reference,
        50000,
        'test',
        'BrewLite',
        new Date(Date.now() + 600000),
      ),
    ).toMatchObject({ rejected: false, paymentUrl: null });
  });
  it('signs cancellation requests and requires provider acknowledgement', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ return_code: 1, sub_return_code: 1 })),
      );
    vi.stubGlobal('fetch', fetchMock);
    expect(await gateway.cancel(reference)).toMatchObject({ cancelled: true });
    const [url, request] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(request.body as string) as Record<string, unknown>;
    expect(url).toBe('https://sb-openapi.zalopay.vn/v2/cancel');
    expect(body.mac).toBe(
      createHmac('sha256', 'test-key1')
        .update(`1234|${reference}|test-key1`)
        .digest('hex'),
    );
  });
});
