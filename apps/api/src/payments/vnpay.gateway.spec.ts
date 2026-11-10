import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { VnpayGateway } from './vnpay.gateway.js';
beforeEach(() => {
  vi.stubEnv('VNPAY_TMN_CODE', 'TESTONLY');
  vi.stubEnv('VNPAY_HASH_SECRET', 'test-only');
});
afterEach(() => vi.unstubAllEnvs());
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
