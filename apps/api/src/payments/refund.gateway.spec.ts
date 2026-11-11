import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RefundGateway, type RefundRequest } from './refund.gateway.js';
import { VnpayGateway } from './vnpay.gateway.js';

const vnpay = new VnpayGateway();
const gateway = new RefundGateway(vnpay);
const request: RefundRequest = {
  providerReference: '11111111111141118111111111111111',
  amount: '45000',
  requestedById: 'actor',
  createdAt: new Date(),
  payment: {
    id: '11111111-1111-4111-8111-111111111111',
    paymentMethod: 'VNPAY',
    transactionId: '12345',
    createdAt: new Date('2026-11-11T01:00:00Z'),
  },
};
beforeEach(() => {
  vi.stubEnv('VNPAY_TMN_CODE', 'TESTONLY');
  vi.stubEnv('VNPAY_HASH_SECRET', 'test-refund-secret');
  vi.stubEnv('ZALOPAY_APP_ID', '1234');
  vi.stubEnv('ZALOPAY_KEY1', 'test-key');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
function receipt(status = '00', type = '02', amount = '4500000') {
  const result: Record<string, string> = {
    vnp_ResponseId: 'response',
    vnp_Command: 'refund',
    vnp_ResponseCode: '00',
    vnp_Message: 'Success',
    vnp_TmnCode: 'TESTONLY',
    vnp_TxnRef: request.payment.id,
    vnp_Amount: amount,
    vnp_BankCode: 'NCB',
    vnp_PayDate: '20261111080000',
    vnp_TransactionNo: '56789',
    vnp_TransactionType: type,
    vnp_TransactionStatus: status,
    vnp_OrderInfo: 'Hoan tien don BrewLite',
  };
  result.vnp_SecureHash = vnpay.sign(Object.values(result).join('|'));
  return result;
}
it('submits a full VNPay refund with original payment reference, amount x100 and exact signing order', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify(receipt())));
  vi.stubGlobal('fetch', fetchMock);
  expect((await gateway.submit(request)).state).toBe('SUCCESS');
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  expect(url).toBe(
    'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
  );
  const body = JSON.parse(init.body as string) as Record<string, string>;
  expect(body.vnp_Command).toBe('refund');
  expect(body.vnp_TransactionType).toBe('02');
  expect(body.vnp_TxnRef).toBe(request.payment.id);
  expect(body.vnp_Amount).toBe('4500000');
  expect(body.vnp_TransactionDate).toBe('20261111080000');
  const hash = body.vnp_SecureHash;
  delete body.vnp_SecureHash;
  expect(hash).toBe(vnpay.sign(Object.values(body).join('|')));
  expect(body).not.toHaveProperty('secret');
});
it.each(['05', '06'])(
  'does not treat VNPay acknowledgment %s as refunded',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(receipt(status)))),
    );
    expect((await gateway.submit(request)).state).toBe('PENDING');
  },
);
it('keeps the real unsigned VNPay sandbox 99 reply unverified instead of declaring a refund complete or rejected', async () => {
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
  await expect(gateway.submit(request)).rejects.toMatchObject({
    code: 'VNPAY_UNVERIFIED_99',
  });
});
it.each(['signature', 'amount', 'merchant', 'reference'])(
  'rejects an invalid VNPay refund %s',
  async (kind) => {
    const body = receipt();
    if (kind === 'signature') body.vnp_SecureHash = '0'.repeat(128);
    if (kind === 'amount') body.vnp_Amount = '1';
    if (kind === 'merchant') body.vnp_TmnCode = 'FOREIGN';
    if (kind === 'reference') body.vnp_TxnRef = 'different';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body))),
    );
    await expect(gateway.submit(request)).rejects.toThrow('xác minh');
  },
);
it('never confuses a successful original payment or a partial refund with a successful full refund', async () => {
  const query = vi.spyOn(vnpay, 'query').mockResolvedValue({
    ...receipt(),
    vnp_Command: 'querydr',
    vnp_TransactionType: '01',
  });
  expect((await gateway.query(request)).state).toBe('PENDING');
  query.mockResolvedValue({
    ...receipt(),
    vnp_Command: 'querydr',
    vnp_TransactionType: '03',
  });
  expect((await gateway.query(request)).state).toBe('PENDING');
});
it('signs ZaloPay refund/query with key1 and reuses the persisted merchant refund ID', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ return_code: 1, refund_id: 12345 })),
    );
  vi.stubGlobal('fetch', fetchMock);
  const input = {
    ...request,
    providerReference: '261111_1234_11111111111141118111111111111111',
    payment: { ...request.payment, paymentMethod: 'ZALOPAY' },
  };
  expect((await gateway.submit(input)).state).toBe('PENDING');
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  const body = JSON.parse(init.body as string) as Record<
    string,
    string | number
  >;
  expect(url).toBe('https://sb-openapi.zalopay.vn/v2/refund');
  expect(body.amount).toBe(45000);
  expect(body.mac).toBe(
    createHmac('sha256', 'test-key')
      .update(`1234|12345|45000|${body.description}|${body.timestamp}`)
      .digest('hex'),
  );
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ return_code: 3 })));
  expect((await gateway.query(input)).state).toBe('PENDING');
  const queryBody = JSON.parse(
    (fetchMock.mock.calls[1][1] as RequestInit).body as string,
  ) as Record<string, string>;
  expect(queryBody.m_refund_id).toBe(input.providerReference);
  expect(queryBody.mac).toBe(
    createHmac('sha256', 'test-key')
      .update(`1234|${input.providerReference}|${queryBody.timestamp}`)
      .digest('hex'),
  );
  fetchMock.mockResolvedValue(
    new Response(JSON.stringify({ return_code: 1, sub_return_code: 1 })),
  );
  expect((await gateway.query(input)).state).toBe('SUCCESS');
});
it('keeps ZaloPay not-found query uncertain instead of submitting a second refund', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ return_code: 2, sub_return_code: -101 })),
      ),
  );
  const input = {
    ...request,
    payment: { ...request.payment, paymentMethod: 'ZALOPAY' },
  };
  expect((await gateway.query(input)).state).toBe('PENDING');
});
it('records an HTTP 403 denied ZaloPay submission as rejected, while a denied query remains uncertain', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(new Response('Permission Denied', { status: 403 })),
      ),
  );
  const input = {
    ...request,
    payment: { ...request.payment, paymentMethod: 'ZALOPAY' },
  };
  expect(await gateway.submit(input)).toMatchObject({
    state: 'FAILED',
    code: 'ZALO:HTTP403',
  });
  await expect(gateway.query(input)).rejects.toThrow();
});
it('retains a ZaloPay queued refund rather than showing an accepted request as complete', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          return_code: 1,
          refund_status: 3,
          refund_id: 12345,
        }),
      ),
    ),
  );
  expect(
    (
      await gateway.submit({
        ...request,
        payment: { ...request.payment, paymentMethod: 'ZALOPAY' },
      })
    ).state,
  ).toBe('PENDING');
});
