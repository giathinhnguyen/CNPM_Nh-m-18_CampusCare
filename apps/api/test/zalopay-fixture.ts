import { createHmac } from 'node:crypto';
export function testZaloCallback(
  reference: string,
  changes: Record<string, unknown> = {},
) {
  const data = JSON.stringify({
    app_id: 1234,
    app_trans_id: reference,
    amount: 50000,
    zp_trans_id: `${Date.now()}${Math.floor(Math.random() * 10000)}`,
    ...changes,
  });
  return {
    data,
    mac: createHmac('sha256', 'test-key2').update(data).digest('hex'),
    type: 1,
  };
}
export function testZaloRedirect(
  reference: string,
  changes: Record<string, string> = {},
) {
  const data = {
    appid: '1234',
    apptransid: reference,
    pmcid: '38',
    bankcode: '',
    amount: '50000',
    discountamount: '0',
    status: '1',
    ...changes,
  };
  return {
    ...data,
    checksum: createHmac('sha256', 'test-key2')
      .update(Object.values(data).join('|'))
      .digest('hex'),
  };
}
