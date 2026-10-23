import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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

    return rewards.filter((reward) => reward.productSize.product.stockQuantity > 0);
  }
}
