import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { PromotionsService } from '../promotions/promotions.service.js';
import type { InventoryService } from '../inventory/inventory.service.js';
import { RewardsCartController } from '../rewards/rewards-cart.controller.js';
import { RewardsCartService } from '../rewards/rewards-cart.service.js';
import { CartsController } from './carts.controller.js';
import { CartsService } from './carts.service.js';

const userId = '10000000-0000-4000-8000-000000000001';
const otherUserId = '10000000-0000-4000-8000-000000000002';
const itemId = '20000000-0000-4000-8000-000000000001';
const req = { user: { id: userId } } as AuthenticatedRequest;

function fixture(owner = userId) {
  const state = { exists: true, reservedPoints: 120, status: 'PENDING' };
  const item = { id: itemId, userId: owner, quantity: 1, rewardRedemptionId: 'redemption' };
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: userId }]),
    cartItem: {
      findFirst: vi.fn(async ({ where }: { where: { userId: string } }) =>
        state.exists && where.userId === owner ? item : null),
      deleteMany: vi.fn(async ({ where }: { where: { userId: string } }) => {
        const count = state.exists && where.userId === owner ? 1 : 0;
        if (count) state.exists = false;
        return { count };
      }),
    },
    rewardRedemption: {
      findUniqueOrThrow: vi.fn(async () => ({ userId: owner, totalPointsSpent: 120, status: state.status })),
      update: vi.fn(async () => { state.status = 'CANCELLED'; }),
    },
    user: { update: vi.fn(async () => { state.reservedPoints -= 120; }) },
  };
  const database = {
    $transaction: vi.fn(async (work: (client: unknown) => unknown) => work(tx)),
  } as unknown as PrismaService;
  const service = new RewardsCartService(database, new CartsService(database), {} as PromotionsService, {} as InventoryService);
  return { state, tx, database, service, controller: new CartsController(service) };
}

describe('legacy /cart uses reward-safe operations', () => {
  it.each(['legacy', 'rewards'] as const)('%s DELETE releases reserved points once, then removes the row', async (prefix) => {
    const f = fixture();
    const controller = prefix === 'legacy' ? f.controller : new RewardsCartController(f.service);
    expect(await controller.removeItem(req, itemId)).toEqual({ count: 1 });
    expect(f.state).toEqual({ exists: false, reservedPoints: 0, status: 'CANCELLED' });
    expect(f.tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(f.tx.user.update.mock.invocationCallOrder[0]!);
    expect(f.tx.rewardRedemption.update.mock.invocationCallOrder[0]).toBeLessThan(f.tx.cartItem.deleteMany.mock.invocationCallOrder[0]!);
    expect(await controller.removeItem(req, itemId)).toEqual({ count: 0 });
    expect(f.tx.user.update).toHaveBeenCalledTimes(1);
    expect(f.database.$transaction).toHaveBeenCalledTimes(2);
  });

  it('legacy PATCH quantity zero releases the reward instead of bypassing cancellation', async () => {
    const f = fixture();
    await f.controller.updateQuantity(req, itemId, { quantity: 0 });
    expect(f.state).toEqual({ exists: false, reservedPoints: 0, status: 'CANCELLED' });
  });

  it('cannot delete another customer reward or release their points', async () => {
    const f = fixture(otherUserId);
    expect(await f.controller.removeItem(req, itemId)).toEqual({ count: 0 });
    expect(f.state).toEqual({ exists: true, reservedPoints: 120, status: 'PENDING' });
    expect(f.tx.user.update).not.toHaveBeenCalled();
  });

  it('legacy PATCH cannot increase a reward quantity or send unknown fields', async () => {
    const f = fixture();
    await expect(f.controller.updateQuantity(req, itemId, { quantity: 2 })).rejects.toThrow('Mỗi lượt đổi thưởng');
    await expect(f.controller.updateQuantity(req, itemId, { isReward: false })).rejects.toBeInstanceOf(BadRequestException);
    expect(f.state.exists).toBe(true);
  });

  it('legacy sync accepts old bodies and forwards an explicit syncId unchanged for retries', async () => {
    const f = fixture();
    const sync = vi.spyOn(f.service, 'syncCart').mockResolvedValue({ items: [], warnings: [], totalAmount: 0, totalItems: 0 });
    await f.controller.syncCart(req, { items: [] });
    const generated = sync.mock.calls[0]![1] as { syncId: string; items: unknown[] };
    expect(generated.syncId).toMatch(/^[0-9a-f-]{36}$/);
    expect(generated.items).toEqual([]);
    const body = { syncId: itemId, items: [] };
    await f.controller.syncCart(req, body);
    expect(sync).toHaveBeenLastCalledWith(userId, body);
  });

  it('restores the admin quote endpoint through the shared pricing implementation', async () => {
    const f = fixture();
    const quote = vi.spyOn(f.service, 'quote').mockRejectedValue(new BadRequestException('invalid quote'));
    const body = { itemIds: [itemId], code: null };
    await expect(f.controller.quote(req, body)).rejects.toThrow('invalid quote');
    expect(quote).toHaveBeenCalledWith(userId, body);
  });
});
