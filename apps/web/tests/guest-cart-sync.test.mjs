import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { syncGuestCart, GUEST_CART_KEY } from '../src/services/guestCartSync.ts';

let values;
const line = { id: 'guest-line', productId: 'product', quantity: 2, unitPrice: 50000 };
beforeEach(() => {
  values = new Map([[GUEST_CART_KEY, JSON.stringify([line])]]);
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
});
afterEach(() => { delete globalThis.localStorage; });

test('keeps the guest cart on HTTP failure and retries with the same syncId', async () => {
  const batches = [];
  await assert.rejects(syncGuestCart('user', async body => {
    batches.push(body);
    return new Response(JSON.stringify({ message: 'server unavailable' }), { status: 503 });
  }, () => 'user'), /server unavailable/);
  assert.equal(JSON.parse(values.get(GUEST_CART_KEY))[0].quantity, 2);
  await syncGuestCart('user', async body => {
    batches.push(body);
    return new Response(JSON.stringify({ warnings: [] }));
  }, () => 'user');
  assert.equal(batches[0].syncId, batches[1].syncId);
  assert.equal(values.has(GUEST_CART_KEY), false);
});

test('network failure retains both snapshot and guest items', async () => {
  await assert.rejects(syncGuestCart('user', async () => { throw new TypeError('offline'); }, () => 'user'), /offline/);
  assert.equal(values.has(GUEST_CART_KEY), true);
  assert.equal(values.has('brewlite_guest_cart_sync'), true);
});

test('concurrent readers share one in-flight sync', async () => {
  let resolve;
  let calls = 0;
  const send = () => { calls++; return new Promise(done => { resolve = done; }); };
  const first = syncGuestCart('user', send, () => 'user');
  const second = syncGuestCart('user', send, () => 'user');
  resolve(new Response(JSON.stringify({ warnings: [] })));
  await Promise.all([first, second]);
  assert.equal(calls, 1);
});

test('preserves additions made in another tab while sync is running', async () => {
  await syncGuestCart('user', async () => {
    values.set(GUEST_CART_KEY, JSON.stringify([{ ...line, quantity: 3 }, { ...line, id: 'new-line', quantity: 1 }]));
    return new Response(JSON.stringify({ warnings: [] }));
  }, () => 'user');
  const remaining = JSON.parse(values.get(GUEST_CART_KEY));
  assert.equal(remaining.length, 2);
  assert.equal(remaining[0].quantity, 1);
  assert.equal(remaining[1].id, 'new-line');
});

test('an account switch never clears the pending guest cart', async () => {
  await assert.rejects(syncGuestCart('user', async () => new Response('{}'), () => 'other'), /Tài khoản đã thay đổi/);
  assert.equal(values.has(GUEST_CART_KEY), true);
  await assert.rejects(syncGuestCart('other', async () => { throw new Error('must not send'); }, () => 'other'), /tài khoản trước/);
});
