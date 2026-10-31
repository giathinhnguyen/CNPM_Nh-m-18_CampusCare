import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { isUuid, lockCustomer, validateObject } from './reward-transactions.js';

@Injectable()
export class RewardsService {
  constructor(private readonly prisma: PrismaService) {}

  async getActiveRewardProducts() {
    const rewards = await this.prisma.rewardProduct.findMany({
      where: {
        isActive: true,
        productSize: {
          isActive: true,
          product: {
            isActive: true,
            category: { isActive: true },
          },
        },
      },
      orderBy: [{ pointsRequired: 'asc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        pointsRequired: true,
        isActive: true,
        productSize: {
          select: {
            id: true,
            size: true,
            product: {
              select: {
                id: true,
                name: true,
                imageUrl: true,
                stockQuantity: true,
              },
            },
          },
        },
      },
    });

    return rewards;
  }

  async getBalance(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await lockCustomer(tx, userId);
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const rewardItem = await tx.cartItem.findFirst({
        where: { userId, rewardRedemptionId: { not: null } },
        select: { id: true },
      });
      return {
        pointsBalance: user.loyaltyPoints,
        reservedPoints: user.reservedPoints,
        availablePoints: user.loyaltyPoints - user.reservedPoints,
        hasRewardInCart: Boolean(rewardItem),
      };
    });
  }

  async redeem(userId: string, body: unknown) {
    const input = validateObject(body, ['rewardProductId', 'idempotencyKey']);
    if (!isUuid(input.rewardProductId) || !isUuid(input.idempotencyKey)) {
      throw new BadRequestException(
        'Cần mã sản phẩm đổi thưởng và mã yêu cầu hợp lệ',
      );
    }
    const rewardProductId = input.rewardProductId.toLowerCase();
    const idempotencyKey = input.idempotencyKey.toLowerCase();
    return this.prisma.$transaction(
      async (tx) => {
        await lockCustomer(tx, userId);
        const previous = await tx.rewardRedemption.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey } },
          include: { cartItem: true },
        });
        if (previous) {
          if (previous.rewardProductId !== rewardProductId)
            throw new ConflictException(
              'Mã yêu cầu đã được dùng cho sản phẩm khác',
            );
          return {
            redemptionId: previous.id,
            cartItem: previous.cartItem,
            status: previous.status,
            replayed: true,
          };
        }
        if (
          await tx.cartItem.findFirst({
            where: { userId, rewardRedemptionId: { not: null } },
          })
        ) {
          throw new ConflictException(
            'Giỏ hàng đã có sản phẩm đổi thưởng. Vui lòng xóa hoặc đặt hàng trước khi đổi tiếp',
          );
        }
        const reward = await tx.rewardProduct.findUnique({
          where: { id: rewardProductId },
          include: {
            productSize: {
              include: { product: { include: { category: true } } },
            },
          },
        });
        if (!reward)
          throw new NotFoundException('Sản phẩm đổi thưởng không tồn tại');
        const productId = reward.productSize.productId;
        // Re-read after locking: a competing checkout may have changed stock.
        await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
        const product = await tx.product.findUniqueOrThrow({
          where: { id: productId },
          include: { category: true },
        });
        if (
          !reward.isActive ||
          !reward.productSize.isActive ||
          !product.isActive ||
          !product.category.isActive ||
          reward.pointsRequired <= 0
        ) {
          throw new BadRequestException(
            'Sản phẩm này hiện không thể đổi thưởng',
          );
        }
        const quantity = await tx.cartItem.aggregate({
          where: { userId, productId },
          _sum: { quantity: true },
        });
        if ((quantity._sum.quantity ?? 0) + 1 > product.stockQuantity)
          throw new BadRequestException(
            'Sản phẩm đã hết hàng hoặc số lượng trong giỏ vượt tồn kho',
          );
        const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
        if (user.loyaltyPoints - user.reservedPoints < reward.pointsRequired)
          throw new BadRequestException(
            'Điểm khả dụng không đủ để đổi sản phẩm này',
          );
        const redemption = await tx.rewardRedemption.create({
          data: {
            userId,
            rewardProductId,
            idempotencyKey,
            productNameSnapshot: product.name,
            sizeSnapshot: reward.productSize.size,
            pointsRequiredSnapshot: reward.pointsRequired,
            totalPointsSpent: reward.pointsRequired,
            quantity: 1,
          },
        });
        const cartItem = await tx.cartItem.create({
          data: {
            userId,
            productId,
            productSizeId: reward.productSizeId,
            rewardRedemptionId: redemption.id,
            quantity: 1,
            sweetnessLevel: 'HUNDRED',
            iceLevel: 'HUNDRED',
          },
        });
        await tx.user.update({
          where: { id: userId },
          data: { reservedPoints: { increment: reward.pointsRequired } },
        });
        return {
          redemptionId: redemption.id,
          cartItem,
          status: redemption.status,
          replayed: false,
        };
      },
      { maxWait: 10000, timeout: 15000 },
    );
  }
}
