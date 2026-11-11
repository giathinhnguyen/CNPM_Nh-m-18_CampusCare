import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VnpayGateway } from './vnpay.gateway.js';
beforeEach(() => {
  vi.stubEnv('VNPAY_TMN_CODE', 'TESTONLY');
  vi.stubEnv('VNPAY_HASH_SECRET', 'test-only');
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it.each(['wallet', 'zalopay', 'other'])(
  'rejects the unsupported VNPay channel %s',
  (channel) => {
    expect(() =>
      new VnpayGateway().url(
        'test',
        '5000000',
        new Date(),
        new Date(Date.now() + 900000),
        '127.0.0.1',
        channel,
      ),
    ).toThrow('thẻ nội địa');
  },
);
it('always uses domestic card routing', () => {
  const url = new URL(
    new VnpayGateway().url(
      'test',
      '5000000',
      new Date(),
      new Date(Date.now() + 900000),
      '127.0.0.1',
      'card',
    ),
  );
  expect(url.searchParams.get('vnp_BankCode')).toBe('VNBANK');
});

it('signs queries with the configured server IP instead of loopback', async () => {
  vi.stubEnv('VNPAY_API_IP', '203.0.113.10');
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        vnp_ResponseCode: '99',
        vnp_Message: 'Unexpected error',
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  const gateway = new VnpayGateway();
  await expect(
    gateway.query('payment', new Date('2026-11-11T01:00:00Z')),
  ).rejects.toThrow();
  const body = JSON.parse(fetchMock.mock.calls[0][1].body) as Record<
    string,
    string
  >;
  expect(body.vnp_IpAddr).toBe('203.0.113.10');
  const signature = body.vnp_SecureHash;
  delete body.vnp_SecureHash;
  expect(signature).toBe(gateway.sign(Object.values(body).join('|')));
});

it('identifies the real unsigned sandbox 99 response without accepting it as a payment result', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          vnp_ResponseCode: '99',
          vnp_Message: 'Unexpected error',
        }),
      ),
    ),
  );
  await expect(
    new VnpayGateway().query('payment', new Date()),
  ).rejects.toMatchObject({ code: 'VNPAY_UNVERIFIED_99' });
});

it('still accepts a correctly signed query receipt for the requested merchant and payment', async () => {
  const gateway = new VnpayGateway();
  const receipt: Record<string, string> = {
    vnp_ResponseId: 'response',
    vnp_Command: 'querydr',
    vnp_ResponseCode: '00',
    vnp_Message: 'Success',
    vnp_TmnCode: 'TESTONLY',
    vnp_TxnRef: 'payment',
    vnp_Amount: '5900000',
    vnp_BankCode: 'NCB',
    vnp_PayDate: '20261111092210',
    vnp_TransactionNo: '12345',
    vnp_TransactionType: '01',
    vnp_TransactionStatus: '00',
    vnp_OrderInfo: 'Test payment',
    vnp_PromotionCode: '',
    vnp_PromotionAmount: '',
  };
  receipt.vnp_SecureHash = gateway.sign(Object.values(receipt).join('|'));
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify(receipt))),
  );
  expect(await gateway.query('payment', new Date())).toEqual(receipt);
});

it.each([
  ['TimeoutError', 'VNPAY_TIMEOUT'],
  ['TypeError', 'VNPAY_NETWORK_ERROR'],
])('identifies %s separately from a failed transaction', async (name, code) => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('private transport details'), { name }),
      ),
  );
  await expect(
    new VnpayGateway().query('payment', new Date()),
  ).rejects.toMatchObject({ code });
});
