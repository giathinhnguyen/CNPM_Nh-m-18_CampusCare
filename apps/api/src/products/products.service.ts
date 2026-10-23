import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // Lấy danh sách sản phẩm đang kinh doanh
  async findAll() {
    return this.prisma.product.findMany({
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

    return product;
  }
}
