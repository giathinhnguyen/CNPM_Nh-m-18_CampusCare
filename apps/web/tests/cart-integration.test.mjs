import { beforeEach, afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { cartIntegrationService } from '../src/services/cartIntegrationService.ts';
import { cartService } from '../src/services/cartService.ts';

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
  assert.equal(calls[0].url, 'http://localhost:3000/api/rewards/cart/items/a');
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

test('badge counts quantities and follows successful guest cart changes', async () => {
  const originalWindow = globalThis.window;
  let updates = 0;
  globalThis.window = { dispatchEvent(event) { if (event.type === 'cart-updated') updates++; } };
  try {
    assert.equal(await cartService.getItemCount(false), 0);
    await cartService.addToCart({ productId: 'drink', productSizeId: 'size', quantity: 3, unitPrice: 50000, stockQuantity: 10 }, false);
    assert.equal(await cartService.getItemCount(false), 3);
    const [{ id }] = JSON.parse(values.get('brewlite_guest_cart'));
    await cartService.updateQuantity(id, 2, false);
    assert.equal(await cartService.getItemCount(false), 2);
    await cartService.removeItem(id, false);
    assert.equal(await cartService.getItemCount(false), 0);
    assert.equal(updates, 3);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('account badge only reads the cart, without syncing or clearing guest items', async () => {
  login();
  const guest = JSON.stringify([{ id: 'guest', quantity: 4 }]);
  values.set('brewlite_guest_cart', guest);
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'http://localhost:3000/api/rewards/cart');
    assert.ok(!init.method || init.method === 'GET');
    return new Response(JSON.stringify({ items: [{ quantity: 3 }, { quantity: 1, isReward: true }] }));
  };
  assert.equal(await cartService.getItemCount(true), 4);
  assert.equal(values.get('brewlite_guest_cart'), guest);
});

test('failed account mutations do not notify the badge of a successful change', async () => {
  login();
  const originalWindow = globalThis.window;
  let updates = 0;
  globalThis.window = { dispatchEvent() { updates++; } };
  globalThis.fetch = async () => new Response('{}', { status: 500 });
  try {
    await assert.rejects(cartService.addToCart({ quantity: 1 }, true));
    await assert.rejects(cartService.updateQuantity('row', 2, true));
    await assert.rejects(cartService.removeItem('row', true));
    assert.equal(updates, 0);
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});
