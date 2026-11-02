import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { DrinkLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';

export const levelPercent: Record<DrinkLevel, number> = {
  ZERO: 0,
  FIFTY: 50,
  HUNDRED: 100,
  ONE_TWENTY: 120,
};
export type InventoryLine = {
  productSizeId: string;
  quantity: number;
  sweetnessLevel?: DrinkLevel;
  iceLevel?: DrinkLevel;
};
export type IngredientUsage = { ingredientId: string; quantity: string };

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async requirements(tx: Prisma.TransactionClient, lines: InventoryLine[]) {
    const sizes = await tx.productSize.findMany({
      where: { id: { in: [...new Set(lines.map((i) => i.productSizeId))] } },
      include: {
        product: { include: { category: true } },
        customizationPolicies: true,
        ingredients: { include: { ingredient: { include: { stock: true } } } },
      },
    });
    const usage = new Map<string, Prisma.Decimal>();
    let cost = new Prisma.Decimal(0);
    for (const line of lines) {
      const size = sizes.find((s) => s.id === line.productSizeId);
      if (
        !size ||
        !size.isActive ||
        !size.product.isActive ||
        !size.product.category.isActive ||
        !size.ingredients.length
      )
        throw new BadRequestException(
          'Món hoặc size chưa có công thức nguyên liệu hợp lệ',
        );
      if (
        !Number.isSafeInteger(line.quantity) ||
        line.quantity < 1 ||
        line.quantity > 10000
      )
        throw new BadRequestException('Số lượng không hợp lệ');
      for (const [axis, value] of [
        ['SUGAR', line.sweetnessLevel ?? 'HUNDRED'],
        ['ICE', line.iceLevel ?? 'HUNDRED'],
      ] as const) {
        const policy = size.customizationPolicies.find((p) => p.axis === axis);
        if (!policy || !policy.allowedLevels.includes(levelPercent[value]))
          throw new BadRequestException(
            `Món ${size.product.name} không hỗ trợ mức ${axis === 'SUGAR' ? 'ngọt' : 'đá'} đã chọn`,
          );
      }
      for (const recipe of size.ingredients) {
        if (
          !recipe.ingredient.isActive ||
          !recipe.ingredient.stock ||
          recipe.quantity.lte(0)
        )
          throw new BadRequestException('Nguyên liệu chưa sẵn sàng để bán');
        const quantity = recipe.quantity
          .times(line.quantity)
          .times(
            recipe.adjustmentGroup === 'SUGAR'
              ? levelPercent[line.sweetnessLevel ?? 'HUNDRED']
              : 100,
          )
          .div(100)
          .toDecimalPlaces(3, Prisma.Decimal.ROUND_UP);
        if (quantity.isZero()) continue;
        usage.set(
          recipe.ingredientId,
          (usage.get(recipe.ingredientId) ?? new Prisma.Decimal(0)).plus(
            quantity,
          ),
        );
        cost = cost.plus(quantity.times(recipe.ingredient.unitCostVnd));
      }
    }
    return {
      usage: [...usage]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([ingredientId, quantity]) => ({
          ingredientId,
          quantity: quantity.toFixed(3),
        })),
      cost,
    };
  }

  async assertAvailable(tx: Prisma.TransactionClient, lines: InventoryLine[]) {
    const result = await this.requirements(tx, lines);
    for (const item of result.usage) {
      const stock = await tx.ingredientStock.findUnique({
        where: { ingredientId: item.ingredientId },
      });
      if (!stock || stock.onHand.minus(stock.reserved).lt(item.quantity))
        throw new ConflictException(
          'Không đủ nguyên liệu cho các món đã chọn. Vui lòng giảm số lượng',
        );
    }
    return result;
  }

  async availability(
    productSizeId: string,
    sweetnessLevel: DrinkLevel = 'HUNDRED',
    iceLevel: DrinkLevel = 'HUNDRED',
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    try {
      const { usage } = await this.requirements(tx, [
        { productSizeId, quantity: 1, sweetnessLevel, iceLevel },
      ]);
      let available = 10000;
      for (const item of usage) {
        const stock = await tx.ingredientStock.findUniqueOrThrow({
          where: { ingredientId: item.ingredientId },
        });
        available = Math.min(
          available,
          stock.onHand
            .minus(stock.reserved)
            .div(item.quantity)
            .floor()
            .toNumber(),
        );
      }
      return Math.max(0, available);
    } catch (error) {
      if (error instanceof BadRequestException) return 0;
      throw error;
    }
  }

  async reserve(
    tx: Prisma.TransactionClient,
    orderId: string,
    lines: InventoryLine[],
  ) {
    const { usage } = await this.requirements(tx, lines);
    // Fixed lock order prevents deadlocks when different products share ingredients.
    for (const item of usage) {
      const changed =
        await tx.$executeRaw`UPDATE ingredient_stocks SET reserved = reserved + ${item.quantity}::numeric, updated_at = NOW()
        WHERE ingredient_id = ${item.ingredientId}::uuid AND on_hand - reserved >= ${item.quantity}::numeric`;
      if (changed !== 1)
        throw new ConflictException(
          'Nguyên liệu vừa hết. Vui lòng kiểm tra lại giỏ hàng',
        );
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        inventoryStatus: 'RESERVED',
        reservedIngredients: usage,
        inventoryReservedAt: new Date(),
      },
    });
  }

  // Caller locks the customer and order first. Snapshot is the sole source after reservation.
  async settle(
    tx: Prisma.TransactionClient,
    orderId: string,
    action: 'DEDUCTED' | 'RELEASED',
  ) {
    const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
    if (order.inventoryStatus !== 'RESERVED') return;
    const usage = order.reservedIngredients as IngredientUsage[];
    if (!Array.isArray(usage))
      throw new ConflictException('Thiếu snapshot nguyên liệu');
    for (const item of [...usage].sort((a, b) =>
      a.ingredientId.localeCompare(b.ingredientId),
    )) {
      const quantity = new Prisma.Decimal(item.quantity);
      const changed = await tx.ingredientStock.updateMany({
        where: {
          ingredientId: item.ingredientId,
          reserved: { gte: quantity },
          onHand: { gte: quantity },
        },
        data: {
          reserved: { decrement: quantity },
          ...(action === 'DEDUCTED' ? { onHand: { decrement: quantity } } : {}),
        },
      });
      if (changed.count !== 1)
        throw new ConflictException(
          'Tồn kho không khớp snapshot, cần đối soát',
        );
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        inventoryStatus: action,
        ...(action === 'DEDUCTED'
          ? { inventoryDeductedAt: new Date() }
          : { inventoryReleasedAt: new Date() }),
      },
    });
  }
}
