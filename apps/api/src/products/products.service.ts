import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { InventoryService } from '../inventory/inventory.service.js';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  private async withAvailability<T extends { sizes: { id: string }[] }>(
    product: T,
  ) {
    const sizes = await Promise.all(
      product.sizes.map(async (size) => ({
        ...size,
        stockQuantity: await this.inventory.availability(size.id),
        customizationPolicies: await this.prisma.customizationPolicy.findMany({
          where: { productSizeId: size.id },
        }),
      })),
    );
    return {
      ...product,
      sizes,
      stockQuantity: Math.max(0, ...sizes.map((s) => s.stockQuantity)),
    };
  }

  // Lấy danh sách sản phẩm đang kinh doanh
  async findAll() {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        category: { isActive: true },
      },
      select: {
        id: true,
        name: true,
        description: true,
        basePrice: true,
        imageUrl: true,
        stockQuantity: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        sizes: {
          where: { isActive: true },
          select: {
            id: true,
            size: true,
            priceAdjustment: true,
          },
          orderBy: { size: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    return Promise.all(
      products.map((product) => this.withAvailability(product)),
    );
  }

  // Lấy chi tiết sản phẩm theo ID
  async findOne(id: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        isActive: true,
        category: { isActive: true },
      },
      include: {
        category: true,
        sizes: {
          where: { isActive: true },
          orderBy: { size: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    return this.withAvailability(product);
  }
}
