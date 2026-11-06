import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { syncGuestCart, GUEST_CART_KEY } from '../src/services/guestCartSync.ts';

let values;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const line = { id: 'guest-line', productId: 'product', quantity: 2, unitPrice: 50000 };
beforeEach(() => {
  let queue = Promise.resolve();
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {
    locks: { request(_name, work) {
      const previous = queue;
      let release;
      queue = new Promise(resolve => { release = resolve; });
      return previous.then(work).finally(() => release());
    } },
  } });
  values = new Map([[GUEST_CART_KEY, JSON.stringify([line])]]);
  globalThis.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key),
  };
});
afterEach(() => {
  delete globalThis.localStorage;
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else delete globalThis.navigator;
});

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
  let started;
  const sending = new Promise(done => { started = done; });
  const send = () => { calls++; started(); return new Promise(done => { resolve = done; }); };
  const first = syncGuestCart('user', send, () => 'user');
  const second = syncGuestCart('user', send, () => 'user');
  await sending;
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
  let owner = 'user';
  await assert.rejects(syncGuestCart('user', async () => {
    owner = 'other';
    return new Response('{}');
  }, () => owner), /Tài khoản đã thay đổi/);
  assert.equal(values.has(GUEST_CART_KEY), true);
  await assert.rejects(syncGuestCart('other', async () => { throw new Error('must not send'); }, () => 'other'), /tài khoản trước/);
});

test('an account changed before syncing does not send its guest cart', async () => {
  let calls = 0;
  await assert.rejects(syncGuestCart('user', async () => {
    calls++;
    return new Response('{}');
  }, () => 'other'), /Tài khoản đã thay đổi/);
  assert.equal(calls, 0);
  assert.equal(values.has(GUEST_CART_KEY), true);
});

test('independent tab instances share the browser lock and do not send a batch twice', async () => {
  const firstTab = await import('../src/services/guestCartSync.ts?tab=first');
  const secondTab = await import('../src/services/guestCartSync.ts?tab=second');
  let calls = 0;
  const send = async () => {
    calls++;
    await new Promise(resolve => setTimeout(resolve, 10));
    return new Response('{}');
  };
  await Promise.all([
    firstTab.syncGuestCart('user', send, () => 'user'),
    secondTab.syncGuestCart('user', send, () => 'user'),
  ]);
  assert.equal(calls, 1);
  assert.equal(values.has(GUEST_CART_KEY), false);
});

test('a browser without cross-tab locks keeps the cart instead of starting an unsafe sync', async () => {
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true });
  globalThis.window = {};
  let calls = 0;
  try {
    await assert.rejects(syncGuestCart('user', async () => { calls++; return new Response('{}'); }, () => 'user'), /chưa hỗ trợ/);
    assert.equal(calls, 0);
    assert.equal(values.has(GUEST_CART_KEY), true);
  } finally {
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
