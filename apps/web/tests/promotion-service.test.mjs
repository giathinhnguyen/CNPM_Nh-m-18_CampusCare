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
