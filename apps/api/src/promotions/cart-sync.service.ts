import { BadRequestException, Injectable } from '@nestjs/common';
import { DrinkLevel } from '@prisma/client';
import { createHash } from 'node:crypto';
import { CartsService } from '../carts/carts.service.js';
import type { AddToCartDto } from '../carts/carts.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CartSyncDto } from './dto/cart-sync.dto.js';

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

@Injectable()
export class CartSyncService {
  constructor(private readonly prisma: PrismaService) {}

  async syncCart(userId: string, body: CartSyncDto) {
    if (!body || !isUuid(body.syncId) || !Array.isArray(body.items)) {
      throw new BadRequestException('Yêu cầu đồng bộ giỏ hàng không hợp lệ');
    }
    const syncId = body.syncId.toLowerCase();
    const items = body.items.map((item) => this.validateItem(item));
    const payloadHash = createHash('sha256').update(JSON.stringify(items)).digest('hex');

    return this.prisma.$transaction(async (tx) => {
      // Hai lần gửi cùng tài khoản phải kiểm tra biên nhận lần lượt.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
      // Tái sử dụng nguyên hàm gộp giỏ; mọi truy vấn của hàm chạy trên cùng transaction.
      // CartsService hiện chỉ phụ thuộc các Prisma delegate, không gọi lifecycle hook.
      const carts = new CartsService(tx as unknown as PrismaService);
      const receipt = await tx.cartSync.findUnique({
        where: { userId_syncId: { userId, syncId } },
      });
      if (receipt) {
        if (receipt.payloadHash !== payloadHash) {
          throw new BadRequestException('Mã đồng bộ đã được dùng cho dữ liệu khác');
        }
        return { ...(await carts.getCart(userId)), warnings: receipt.warnings };
      }

      const availableItems: AddToCartDto[] = [];
      const warnings: string[] = [];
      for (const item of items) {
        const size = await tx.productSize.findFirst({
          where: {
            id: item.productSizeId,
            productId: item.productId,
            isActive: true,
            product: { isActive: true, category: { isActive: true } },
          },
        });
        const count = await tx.topping.count({
          where: { id: { in: item.toppingIds }, isActive: true },
        });
        if (!size || count !== item.toppingIds.length) {
          warnings.push('Một món có sản phẩm, size hoặc topping không còn khả dụng và chưa được chuyển vào giỏ tài khoản');
          continue;
        }
        availableItems.push(item);
      }

      const result = await carts.syncCart(userId, availableItems);
      if ('warnings' in result) warnings.push(...result.warnings);
      await tx.cartSync.create({ data: { userId, syncId, payloadHash, warnings } });
      return { ...result, warnings };
    }, { timeout: 15000 });
  }

  private validateItem(item: AddToCartDto) {
    if (
      !item || typeof item !== 'object' ||
      !isUuid(item.productId) || !isUuid(item.productSizeId) ||
      !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ||
      (item.note != null && (typeof item.note !== 'string' || item.note.length > 255))
    ) {
      throw new BadRequestException('Dữ liệu món đồng bộ không hợp lệ');
    }
    const toppingIds = item.toppingIds ?? [];
    if (!Array.isArray(toppingIds) || !toppingIds.every(isUuid)) {
      throw new BadRequestException('Danh sách topping không hợp lệ');
    }
    const normalizedIds = toppingIds.map((id) => id.toLowerCase()).sort();
    if (new Set(normalizedIds).size !== normalizedIds.length) {
      throw new BadRequestException('Không được chọn trùng topping');
    }
    const sweetnessLevel = item.sweetnessLevel ?? DrinkLevel.HUNDRED;
    const iceLevel = item.iceLevel ?? DrinkLevel.HUNDRED;
    if (!Object.values(DrinkLevel).includes(sweetnessLevel) || !Object.values(DrinkLevel).includes(iceLevel)) {
      throw new BadRequestException('Mức ngọt hoặc mức đá không hợp lệ');
    }
    return {
      productId: item.productId.toLowerCase(),
      productSizeId: item.productSizeId.toLowerCase(),
      quantity: item.quantity,
      sweetnessLevel,
      iceLevel,
      toppingIds: normalizedIds,
      note: item.note ?? undefined,
    };
  }
}
