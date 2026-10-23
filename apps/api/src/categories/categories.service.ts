import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // Lấy các danh mục đang hoạt động
  async findAll() {
    return this.prisma.category.findMany({
      where: {
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        displayOrder: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });
  }
}
