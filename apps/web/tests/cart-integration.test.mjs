import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { cartIntegrationService } from '../src/services/cartIntegrationService.ts';

const originalFetch = globalThis.fetch;
let values;
beforeEach(() => {
  values = new Map();
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
});
afterEach(() => { globalThis.fetch = originalFetch; delete globalThis.localStorage; });
const login = () => values.set('brewlite_access_token', `header.${btoa(JSON.stringify({ sub: 'user', exp: Date.now() / 1000 + 3600 }))}.signature`);

test('saving an empty guest selection survives reload and preserves other-tab additions', async () => {
  values.set('brewlite_guest_cart', JSON.stringify([{ id: 'a', quantity: 2 }, { id: 'new', quantity: 1 }]));
  await cartIntegrationService.saveSelection([{ id: 'a' }], [], false);
  const items = JSON.parse(values.get('brewlite_guest_cart'));
  assert.equal(items[0].isSelected, false);
  assert.equal(items[0].quantity, 2);
  assert.equal(items[1].isSelected, undefined);
});

test('account selection reuses the existing PATCH API without sending quantity or price', async () => {
  login();
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response('{}');
  };
  await cartIntegrationService.saveSelection([{ id: 'a', isSelected: true }, { id: 'b', isSelected: false }], [], true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://localhost:3000/api/cart/items/a');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].init.body), { isSelected: false });
  assert.ok(calls[0].init.headers.get('Authorization').startsWith('Bearer '));
});

test('partial PATCH failure waits for remaining requests and reports failure', async () => {
  login();
  let completed = 0;
  globalThis.fetch = async url => {
    if (url.endsWith('/a')) return new Response('{}', { status: 500 });
    await Promise.resolve();
    completed++;
    return new Response('{}');
  };
  await assert.rejects(cartIntegrationService.saveSelection([{ id: 'a' }, { id: 'b' }], [], true), /Chưa lưu được đầy đủ/);
  assert.equal(completed, 1);
});
