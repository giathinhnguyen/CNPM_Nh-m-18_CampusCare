import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { promotionService, PromotionApiError } from '../src/services/promotionService.ts';

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
test('guest and account carts send the same minimal request and use server prices', async () => {
  const bodies = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'http://localhost:3000/api/promotions/quote');
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ promotionCode: 'BREW10', totalAmount: '120000', discountAmount: '12000', finalAmount: '108000', items: [{ productSizeId: 'size', unitPrice: '60000', totalPrice: '120000' }] }));
  };
  const guest = await promotionService.quote('BREW10', [{ productSizeId: 'size', quantity: 2, toppingIds: ['top'], unitPrice: 1 }]);
  await promotionService.quote('BREW10', [{ productSizeId: 'size', quantity: 2, toppings: [{ id: 'top' }] }]);
  assert.deepEqual(bodies[0], bodies[1]);
  assert.equal(Object.hasOwn(bodies[0].items[0], 'unitPrice'), false);
  assert.equal(guest.discountAmount, 12000);
  assert.equal(guest.items[0].unitPrice, 60000);
});
test('supports pricing without a promotion and reports API validation errors', async () => {
  globalThis.fetch = async (_url, init) => {
    assert.equal(JSON.parse(init.body).code, null);
    return new Response(JSON.stringify({ message: 'Giỏ chưa đủ điều kiện' }), { status: 400 });
  };
  await assert.rejects(promotionService.quote(null, [{ productSizeId: 'size', quantity: 1 }]), error => error instanceof PromotionApiError && error.status === 400 && error.message === 'Giỏ chưa đủ điều kiện');
});

test('logged-in carts use the rewards adapter without restoring the removed cart quote endpoint', async () => {
  const originalStorage = globalThis.localStorage;
  const originalWindow = globalThis.window;
  const token = `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.signature`;
  globalThis.localStorage = { getItem: () => token };
  globalThis.window = { dispatchEvent() {} };
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(url, 'http://localhost:3000/api/rewards/cart/quote');
      assert.equal(new Headers(init.headers).get('Authorization'), `Bearer ${token}`);
      assert.deepEqual(JSON.parse(init.body), {
        code: null,
        itemIds: ['row-a', 'row-b'],
      });
      return new Response(JSON.stringify({ promotionCode: null, totalAmount: '150000', discountAmount: '0', finalAmount: '150000', items: [] }));
    };
    const quote = await promotionService.quote(null, [
      { id: 'row-a', productSizeId: 'size-a', quantity: 2, toppings: [{ id: 'top' }], unitPrice: 1 },
      { id: 'row-b', productSizeId: 'size-b', quantity: 1 },
    ]);
    assert.equal(quote.finalAmount, 150000);
  } finally { globalThis.localStorage = originalStorage; globalThis.window = originalWindow; }
});
