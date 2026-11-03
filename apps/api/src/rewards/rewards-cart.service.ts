import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DrinkLevel, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { CartsService } from '../carts/carts.service.js';
import type { AddToCartDto } from '../carts/carts.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import {
  isUuid,
  lockCustomer,
  releaseRedemption,
  validateObject,
} from './reward-transactions.js';

@Injectable()
export class RewardsCartService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carts: CartsService,
    private readonly promotions: PromotionsService,
    private readonly inventory: InventoryService = new InventoryService(prisma),
  ) {}

  private originalCart(tx: Prisma.TransactionClient) {
    // Hàm giỏ gốc được tái sử dụng với client của cùng transaction.
    return new CartsService(tx as PrismaService);
  }

  async getCart(userId: string, tx: Prisma.TransactionClient = this.prisma) {
    const base =
      tx === this.prisma
        ? await this.carts.getCart(userId)
        : await this.originalCart(tx).getCart(userId);
    const metadata = await tx.cartItem.findMany({
      where: { userId },
      include: {
        rewardRedemption: { include: { rewardProduct: true } },
        product: { include: { category: true } },
        productSize: true,
        toppings: { include: { topping: true } },
      },
    });
    const byId = new Map(metadata.map((item) => [item.id, item]));
    const items = await Promise.all(
      base.items.map(async (item) => {
        const source = byId.get(item.id);
        const reward = source?.rewardRedemption;
        const invalidReward = Boolean(
          reward &&
          (reward.status !== 'PENDING' ||
            reward.orderId !== null ||
            reward.userId !== userId ||
            !reward.rewardProduct.isActive ||
            reward.rewardProduct.productSizeId !== item.productSizeId ||
            item.quantity !== 1 ||
            item.toppings.length !== 0),
        );
        const available = await this.inventory.availability(
          item.productSizeId,
          item.sweetnessLevel,
          item.iceLevel,
          tx,
        );
        // Không dùng cờ tồn kho sản phẩm của giỏ cũ: admin quản lý kho nguyên liệu.
        const isOutOfStock =
          !source ||
          !source.product.isActive ||
          !source.productSize.isActive ||
          !source.product.category.isActive ||
          source.productSize.productId !== item.productId ||
          source.toppings.some((entry) => !entry.topping.isActive) ||
          available < item.quantity ||
          invalidReward;
        const unitPrice = reward ? 0 : item.unitPrice;
        return {
          ...item,
          unitPrice,
          totalPrice: unitPrice * item.quantity,
          isOutOfStock,
          stockQuantity: available,
          isReward: Boolean(reward),
          rewardPoints: reward?.totalPointsSpent ?? null,
          rewardRedemptionId: source?.rewardRedemptionId ?? null,
        };
      }),
    );
    return {
      items,
      totalAmount: items.reduce(
        (sum, item) =>
          sum + (!item.isOutOfStock && item.isSelected ? item.totalPrice : 0),
        0,
      ),
      totalItems: items.reduce((sum, item) => sum + item.quantity, 0),
    };
  }

  async quote(userId: string, body: unknown) {
    const input = validateObject(body, ['itemIds', 'code']);
    if (
      !Array.isArray(input.itemIds) ||
      !input.itemIds.length ||
      input.itemIds.length > 100 ||
      !input.itemIds.every(isUuid) ||
      (input.code != null &&
        (typeof input.code !== 'string' ||
          !input.code.trim() ||
          input.code.trim().length > 50))
    )
      throw new BadRequestException(
        'Danh sách món hoặc mã ưu đãi không hợp lệ',
      );
    const itemIds = input.itemIds.map((id) => id.toLowerCase());
    if (new Set(itemIds).size !== itemIds.length)
      throw new BadRequestException('Không được chọn trùng món');
    const code =
      typeof input.code === 'string' ? input.code.trim().toUpperCase() : null;
    return this.withCustomer(userId, async (tx) => {
      const cart = await this.getCart(userId, tx);
      const byId = new Map(cart.items.map((item) => [item.id, item]));
      const selected = itemIds.map((id) => {
        const item = byId.get(id);
        if (!item)
          throw new BadRequestException(
            'Món không còn tồn tại hoặc không thuộc giỏ hàng của bạn',
          );
        if (item.isOutOfStock)
          throw new BadRequestException(
            'Món không còn khả dụng hoặc số lượng vượt tồn kho',
          );
        return item;
      });
      const regular = selected.filter((item) => !item.isReward);
      await this.inventory.assertAvailable(tx, selected);
      if (!regular.length && code)
        throw new BadRequestException(
          'Mã ưu đãi chỉ áp dụng cho sản phẩm mua thường',
        );
      const zero = new Prisma.Decimal(0);
      const quote = regular.length
        ? await this.promotions.calculateQuote(tx, {
            code,
            items: regular.map((item) => ({
              productSizeId: item.productSizeId,
              quantity: item.quantity,
              toppingIds: item.toppings.map((topping) => topping.id),
            })),
          })
        : {
            promotionId: null,
            promotionCode: null,
            totalAmount: zero,
            discountAmount: zero,
            finalAmount: zero,
            items: [],
          };
      const prices = new Map(
        regular.map((item, index) => [item.id, quote.items[index]]),
      );
      return {
        ...quote,
        items: selected.map((item) => ({
          cartItemId: item.id,
          productSizeId: item.productSizeId,
          unitPrice: prices.get(item.id)?.unitPrice ?? zero,
          totalPrice: prices.get(item.id)?.totalPrice ?? zero,
        })),
      };
    });
  }

  private validateItem(body: AddToCartDto) {
    if (
      !body ||
      !isUuid(body.productId) ||
      !isUuid(body.productSizeId) ||
      !Number.isSafeInteger(body.quantity) ||
      body.quantity < 1 ||
      body.quantity > 10000 ||
      (body.note != null &&
        (typeof body.note !== 'string' || body.note.length > 255))
    )
      throw new BadRequestException('Cấu hình món hoặc số lượng không hợp lệ');
    const toppingIds = body.toppingIds ?? [];
    if (!Array.isArray(toppingIds) || !toppingIds.every(isUuid))
      throw new BadRequestException('Danh sách topping không hợp lệ');
    const normalizedIds = toppingIds.map((id) => id.toLowerCase()).sort();
    if (new Set(normalizedIds).size !== normalizedIds.length)
      throw new BadRequestException('Không được chọn trùng topping');
    const sweetnessLevel = body.sweetnessLevel ?? DrinkLevel.HUNDRED;
    const iceLevel = body.iceLevel ?? DrinkLevel.HUNDRED;
    if (
      !Object.values(DrinkLevel).includes(sweetnessLevel) ||
      !Object.values(DrinkLevel).includes(iceLevel)
    )
      throw new BadRequestException('Mức ngọt hoặc mức đá không hợp lệ');
    return {
      productId: body.productId.toLowerCase(),
      productSizeId: body.productSizeId.toLowerCase(),
      quantity: body.quantity,
      toppingIds: normalizedIds,
      sweetnessLevel,
      iceLevel,
      note: body.note ?? undefined,
    };
  }

  private async addRegular(
    tx: Prisma.TransactionClient,
    userId: string,
    item: ReturnType<RewardsCartService['validateItem']>,
  ) {
    const size = await tx.productSize.findFirst({
      where: {
        id: item.productSizeId,
        productId: item.productId,
        isActive: true,
        product: { isActive: true, category: { isActive: true } },
      },
      include: { product: true },
    });
    if (!size)
      throw new NotFoundException(
        'Sản phẩm hoặc kích thước không còn khả dụng',
      );
    const toppingCount = await tx.topping.count({
      where: { id: { in: item.toppingIds }, isActive: true },
    });
    if (toppingCount !== item.toppingIds.length)
      throw new BadRequestException('Topping không còn khả dụng');
    const existing = await tx.cartItem.findMany({
      where: { userId, productId: item.productId },
      include: { toppings: true },
    });
    // Giữ cách nhận diện món trùng của giỏ gốc, tách dòng thưởng và kiểm tra kho chung.
    const matched = existing.find(
      (row) =>
        !row.rewardRedemptionId &&
        row.productSizeId === item.productSizeId &&
        row.sweetnessLevel === item.sweetnessLevel &&
        row.iceLevel === item.iceLevel &&
        JSON.stringify(
          row.toppings.map((topping) => topping.toppingId).sort(),
        ) === JSON.stringify(item.toppingIds),
    );
    const otherItems = await tx.cartItem.findMany({
      where: { userId, ...(matched ? { id: { not: matched.id } } : {}) },
    });
    await this.inventory.assertAvailable(tx, [
      ...otherItems,
      { ...item, quantity: (matched?.quantity ?? 0) + item.quantity },
    ]);
    if (matched)
      return tx.cartItem.update({
        where: { id: matched.id },
        data: { quantity: { increment: item.quantity } },
      });
    return tx.cartItem.create({
      data: {
        userId,
        productId: item.productId,
        productSizeId: item.productSizeId,
        quantity: item.quantity,
        sweetnessLevel: item.sweetnessLevel,
        iceLevel: item.iceLevel,
        note: item.note,
        toppings: {
          create: item.toppingIds.map((toppingId) => ({ toppingId })),
        },
      },
    });
  }

  async addToCart(userId: string, body: AddToCartDto) {
    const item = this.validateItem(body);
    return this.withCustomer(userId, (tx) => this.addRegular(tx, userId, item));
  }

  async updateQuantity(
    userId: string,
    itemId: string,
    quantity?: number,
    note?: string,
    isSelected?: boolean,
  ) {
    if (
      !isUuid(itemId) ||
      (quantity !== undefined &&
        (!Number.isSafeInteger(quantity) || quantity < 0)) ||
      (note !== undefined && (typeof note !== 'string' || note.length > 255)) ||
      (isSelected !== undefined && typeof isSelected !== 'boolean')
    )
      throw new BadRequestException('Dữ liệu cập nhật không hợp lệ');
    return this.withCustomer(userId, async (tx) => {
      if (quantity === 0) return this.remove(tx, userId, itemId);
      const item = await tx.cartItem.findFirst({
        where: { id: itemId, userId },
      });
      if (!item) throw new NotFoundException('Món không tồn tại trong giỏ');
      if (item.rewardRedemptionId && quantity !== undefined && quantity !== 1)
        throw new BadRequestException('Mỗi lượt đổi thưởng chỉ có 1 sản phẩm');
      if (quantity !== undefined && quantity > item.quantity) {
        await this.inventory.assertAvailable(tx, [
          ...(await tx.cartItem.findMany({
            where: { userId, id: { not: itemId } },
          })),
          { ...item, quantity },
        ]);
        return tx.cartItem.update({
          where: { id: itemId },
          data: { quantity, note, isSelected },
        });
      }
      return this.originalCart(tx).updateQuantity(
        userId,
        itemId,
        quantity,
        note,
        isSelected,
      );
    });
  }

  private async remove(
    tx: Prisma.TransactionClient,
    userId: string,
    itemId: string,
  ) {
    const item = await tx.cartItem.findFirst({ where: { id: itemId, userId } });
    if (item?.rewardRedemptionId)
      await releaseRedemption(tx, item.rewardRedemptionId);
    return this.originalCart(tx).removeItem(userId, itemId);
  }

  async removeItem(userId: string, itemId: string) {
    if (!isUuid(itemId)) throw new BadRequestException('Mã món không hợp lệ');
    return this.withCustomer(userId, (tx) => this.remove(tx, userId, itemId));
  }

  async syncCart(userId: string, body: unknown) {
    const input = validateObject(body, ['syncId', 'items']);
    if (
      !isUuid(input.syncId) ||
      !Array.isArray(input.items) ||
      input.items.length > 100
    )
      throw new BadRequestException('Yêu cầu đồng bộ giỏ không hợp lệ');
    const syncId = input.syncId.toLowerCase();
    const items = input.items.map((item) => this.validateItem(item));
    const payloadHash = createHash('sha256')
      .update(JSON.stringify(items))
      .digest('hex');
    return this.withCustomer(userId, async (tx) => {
      const receipt = await tx.cartSync.findUnique({
        where: { userId_syncId: { userId, syncId } },
      });
      if (receipt) {
        if (receipt.payloadHash !== payloadHash)
          throw new BadRequestException(
            'Mã đồng bộ đã được dùng cho dữ liệu khác',
          );
        return {
          ...(await this.getCart(userId, tx)),
          warnings: receipt.warnings,
        };
      }
      const warnings: string[] = [];
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });
        if (!product?.isActive) {
          warnings.push('Một món đã ngừng bán và chưa được chuyển vào giỏ');
          continue;
        }
        const remaining = await this.syncQuantity(tx, userId, item);
        if (item.quantity > remaining)
          warnings.push(
            `Món "${product.name}" chỉ thêm được ${remaining} ly do giới hạn nguyên liệu.`,
          );
        if (remaining > 0)
          await this.addRegular(tx, userId, {
            ...item,
            quantity: Math.min(item.quantity, remaining),
          });
      }
      await tx.cartSync.create({
        data: { userId, syncId, payloadHash, warnings },
      });
      return { ...(await this.getCart(userId, tx)), warnings };
    });
  }

  private async syncQuantity(
    tx: Prisma.TransactionClient,
    userId: string,
    item: ReturnType<RewardsCartService['validateItem']>,
  ) {
    const existing = await tx.cartItem.findMany({ where: { userId } });
    const fits = async (quantity: number) => {
      try {
        await this.inventory.assertAvailable(tx, [
          ...existing,
          { ...item, quantity },
        ]);
        return true;
      } catch (error) {
        if (error instanceof ConflictException) return false;
        throw error;
      }
    };
    if (await fits(item.quantity)) return item.quantity;
    // Tìm phần có thể thêm bằng cùng phép kiểm tra công thức/đường/đá của admin.
    let low = 0,
      high = item.quantity - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (await fits(middle)) low = middle;
      else high = middle - 1;
    }
    return low;
  }

  private withCustomer<T>(
    userId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        await lockCustomer(tx, userId);
        return work(tx);
      },
      { maxWait: 10000, timeout: 15000 },
    );
  }
}
