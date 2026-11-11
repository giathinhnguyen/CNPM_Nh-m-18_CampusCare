import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { isUuid, validateObject } from '../rewards/reward-transactions.js';

function text(value: unknown, label: string, max = 120) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new BadRequestException(`${label} không hợp lệ`);
  return value.trim();
}
function number(value: unknown, label: string, max = 999999999, decimals = 0) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > max ||
    Math.abs(value * 10 ** decimals - Math.round(value * 10 ** decimals)) >
      0.00001
  )
    throw new BadRequestException(`${label} không hợp lệ`);
  return value;
}
function flag(value: unknown) {
  if (typeof value !== 'boolean')
    throw new BadRequestException('Trạng thái không hợp lệ');
  return value;
}
function id(value: string) {
  if (!isUuid(value)) throw new BadRequestException('Mã không hợp lệ');
  return value;
}
function stale(actual: Date, expected: unknown) {
  if (typeof expected !== 'string' || actual.toISOString() !== expected)
    throw new ConflictException(
      'Dữ liệu đã thay đổi. Hãy tải lại trước khi sửa.',
    );
}

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}
  async overview() {
    const [ingredients, customers, products, promotions, categories] =
      await Promise.all([
        this.prisma.ingredient.findMany({
          include: { stock: true },
          orderBy: { code: 'asc' },
        }),
        this.prisma.user.findMany({
          where: { role: 'CUSTOMER' },
          select: {
            id: true,
            fullName: true,
            email: true,
            loyaltyPoints: true,
            reservedPoints: true,
            createdAt: true,
            _count: { select: { orders: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 500,
        }),
        this.prisma.product.findMany({
          include: {
            category: true,
            sizes: {
              orderBy: { size: 'asc' },
              include: {
                ingredients: { include: { ingredient: true } },
                customizationPolicies: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        }),
        this.prisma.promotion.findMany({ orderBy: { createdAt: 'desc' } }),
        this.prisma.category.findMany({ orderBy: { displayOrder: 'asc' } }),
      ]);
    return { ingredients, customers, products, promotions, categories };
  }
  customerOrders(userId: string) {
    return this.prisma.order.findMany({
      where: { userId: id(userId), user: { role: 'CUSTOMER' } },
      select: {
        id: true,
        orderCode: true,
        status: true,
        paidAt: true,
        refunds: { select: { id: true, amount: true, reason: true, status: true, mode: true, providerRefundId: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'desc' } },
        finalAmount: true,
        payments: { select: { transactionId: true, status: true } },
        createdAt: true,
        items: { select: { productName: true, quantity: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
  async ingredient(ingredientId: string | null, body: unknown) {
    const b = validateObject(body, [
      'code',
      'name',
      'unit',
      'unitCostVnd',
      'reorderLevel',
      'onHand',
      'isActive',
      'updatedAt',
      'stockUpdatedAt',
    ]);
    const code = text(b.code, 'Mã nguyên liệu', 10).toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(code))
      throw new BadRequestException('Mã chỉ gồm chữ, số, gạch ngang');
    const unit = text(b.unit, 'Đơn vị', 5);
    if (!['g', 'ml', 'pcs'].includes(unit))
      throw new BadRequestException('Đơn vị phải là g, ml hoặc pcs');
    const data = {
      code,
      name: text(b.name, 'Tên'),
      unit,
      unitCostVnd: number(b.unitCostVnd, 'Giá vốn', 999999999, 4),
      reorderLevel: number(b.reorderLevel, 'Ngưỡng nhập', 999999999, 3),
      isActive: flag(b.isActive),
    };
    const onHand = number(b.onHand, 'Tồn thực tế', 999999999, 3);
    return this.prisma.$transaction(async (tx) => {
      if (!ingredientId)
        return tx.ingredient.create({
          data: { ...data, stock: { create: { onHand } } },
        });
      id(ingredientId);
      await tx.$queryRaw`SELECT id FROM ingredients WHERE id = ${ingredientId}::uuid FOR UPDATE`;
      await tx.$queryRaw`SELECT ingredient_id FROM ingredient_stocks WHERE ingredient_id = ${ingredientId}::uuid FOR UPDATE`;
      const current = await tx.ingredient.findUnique({
        where: { id: ingredientId },
        include: { stock: true, _count: { select: { products: true } } },
      });
      if (!current) throw new NotFoundException('Không tìm thấy nguyên liệu');
      stale(current.updatedAt, b.updatedAt);
      if (current.stock) stale(current.stock.updatedAt, b.stockUpdatedAt);
      if (
        current.unit !== unit &&
        (current._count.products > 0 || current.stock?.onHand.gt(0))
      )
        throw new BadRequestException(
          'Không đổi đơn vị khi đã có công thức hoặc tồn kho',
        );
      if (current.stock && current.stock.reserved.gt(onHand))
        throw new BadRequestException(
          'Tồn thực tế không được nhỏ hơn lượng đang giữ cho đơn hàng',
        );
      await tx.ingredientStock.upsert({
        where: { ingredientId },
        create: { ingredientId, onHand },
        update: { onHand },
      });
      return tx.ingredient.update({ where: { id: ingredientId }, data });
    });
  }
  async product(productId: string | null, body: unknown) {
    const b = validateObject(body, [
      'name',
      'description',
      'categoryId',
      'basePrice',
      'imageUrl',
      'isActive',
      'updatedAt',
    ]);
    const categoryId = id(text(b.categoryId, 'Danh mục', 36));
    if (!(await this.prisma.category.findUnique({ where: { id: categoryId } })))
      throw new BadRequestException('Danh mục không tồn tại');
    const imageUrl = typeof b.imageUrl === 'string' ? b.imageUrl.trim() : '';
    if (imageUrl && (imageUrl.length > 500 || !/^https?:\/\//i.test(imageUrl)))
      throw new BadRequestException('Ảnh phải là URL http/https');
    const data = {
      name: text(b.name, 'Tên món', 100),
      description:
        typeof b.description === 'string' ? b.description.slice(0, 2000) : '',
      categoryId,
      basePrice: number(b.basePrice, 'Giá bán'),
      imageUrl: imageUrl || null,
      isActive: flag(b.isActive),
    };
    if (!productId)
      return this.prisma.product.create({
        data: {
          ...data,
          sizes: {
            create: (['S', 'M', 'L'] as const).map((size, i) => ({
              size,
              priceAdjustment: [0, 8000, 14000][i],
              cupVolumeMl: [350, 500, 700][i],
            })),
          },
        },
      });
    id(productId);
    const current = await this.prisma.product.findUnique({
      where: { id: productId },
    });
    if (!current) throw new NotFoundException('Không tìm thấy món');
    stale(current.updatedAt, b.updatedAt);
    const result = await this.prisma.product.updateMany({
      where: { id: productId, updatedAt: current.updatedAt },
      data: { ...data, version: { increment: 1 } },
    });
    if (!result.count)
      throw new ConflictException('Món vừa được chỉnh sửa. Hãy tải lại.');
    return { ok: true };
  }
  async recipe(sizeId: string, body: unknown) {
    id(sizeId);
    const b = validateObject(body, [
      'updatedAt',
      'ingredients',
      'priceAdjustment',
      'cupVolumeMl',
    ]);
    if (
      !Array.isArray(b.ingredients) ||
      !b.ingredients.length ||
      b.ingredients.length > 100
    )
      throw new BadRequestException('Công thức cần ít nhất một nguyên liệu');
    const rows = b.ingredients.map((row) => {
      const r = validateObject(row, [
        'ingredientId',
        'quantity',
        'adjustmentGroup',
      ]);
      const quantity = number(r.quantity, 'Định lượng', 999999, 3);
      if (!quantity || !['FIXED', 'SUGAR'].includes(String(r.adjustmentGroup)))
        throw new BadRequestException('Định lượng/nhóm không hợp lệ');
      return {
        ingredientId: id(text(r.ingredientId, 'Nguyên liệu', 36)),
        quantity,
        adjustmentGroup: r.adjustmentGroup as 'FIXED' | 'SUGAR',
      };
    });
    if (new Set(rows.map((r) => r.ingredientId)).size !== rows.length)
      throw new BadRequestException('Nguyên liệu bị lặp');
    const priceAdjustment = number(b.priceAdjustment, 'Giá cộng thêm');
    const cupVolumeMl = number(b.cupVolumeMl, 'Dung tích', 5000);
    if (!cupVolumeMl) throw new BadRequestException('Dung tích phải lớn hơn 0');
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM product_sizes WHERE id = ${sizeId}::uuid FOR UPDATE`;
      const size = await tx.productSize.findUnique({ where: { id: sizeId } });
      if (!size) throw new NotFoundException('Không tìm thấy size');
      stale(size.updatedAt, b.updatedAt);
      const ingredients = await tx.ingredient.findMany({
        where: { id: { in: rows.map((r) => r.ingredientId) }, isActive: true },
      });
      if (ingredients.length !== rows.length)
        throw new BadRequestException('Nguyên liệu không tồn tại hoặc đã tắt');
      if (
        rows.some(
          (r) =>
            r.adjustmentGroup === 'SUGAR' &&
            ingredients.find((i) => i.id === r.ingredientId)?.code !== 'NL011',
        )
      )
        throw new BadRequestException(
          'Chỉ nước đường NL011 được điều chỉnh theo mức đường',
        );
      await tx.productIngredient.deleteMany({
        where: { productSizeId: sizeId },
      });
      await tx.productIngredient.createMany({
        data: rows.map((r) => ({ ...r, productSizeId: sizeId })),
      });
      for (const axis of ['SUGAR', 'ICE'] as const) {
        const allowedLevels =
          axis === 'ICE' || rows.some((r) => r.adjustmentGroup === 'SUGAR')
            ? [0, 50, 100, 120]
            : [100];
        const data = {
          allowedLevels,
          defaultLevel: 100,
          policyNote:
            axis === 'ICE'
              ? 'Không trừ kho nước và đá.'
              : 'Chỉ thay đổi lượng nước đường thêm vào.',
        };
        await tx.customizationPolicy.upsert({
          where: { productSizeId_axis: { productSizeId: sizeId, axis } },
          create: { productSizeId: sizeId, axis, ...data },
          update: data,
        });
      }
      return tx.productSize.update({
        where: { id: sizeId },
        data: { priceAdjustment, cupVolumeMl },
      });
    });
  }
  async promotion(promotionId: string | null, body: unknown) {
    const b = validateObject(body, [
      'code',
      'title',
      'description',
      'discountType',
      'discountValue',
      'minOrderAmount',
      'maxDiscountAmount',
      'isActive',
      'startDate',
      'endDate',
      'updatedAt',
    ]);
    if (!['FIXED', 'PERCENTAGE'].includes(String(b.discountType)))
      throw new BadRequestException('Loại giảm không hợp lệ');
    const discountType = b.discountType as 'FIXED' | 'PERCENTAGE';
    const discountValue = number(
      b.discountValue,
      'Mức giảm',
      discountType === 'PERCENTAGE' ? 100 : 999999999,
    );
    if (!discountValue)
      throw new BadRequestException('Mức giảm phải lớn hơn 0');
    const date = (v: unknown) => {
      if (!v) return null;
      if (typeof v !== 'string' || !Number.isFinite(Date.parse(v)))
        throw new BadRequestException('Ngày không hợp lệ');
      return new Date(v);
    };
    const startDate = date(b.startDate),
      endDate = date(b.endDate);
    if (startDate && endDate && startDate >= endDate)
      throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu');
    const code = text(b.code, 'Mã ưu đãi', 50).toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(code))
      throw new BadRequestException('Mã ưu đãi không hợp lệ');
    const data = {
      code,
      title: text(b.title, 'Tiêu đề', 100),
      description:
        typeof b.description === 'string' ? b.description.slice(0, 2000) : '',
      discountType,
      discountValue,
      minOrderAmount: number(b.minOrderAmount, 'Đơn tối thiểu'),
      maxDiscountAmount:
        b.maxDiscountAmount === null
          ? null
          : number(b.maxDiscountAmount, 'Giảm tối đa'),
      isActive: flag(b.isActive),
      startDate,
      endDate,
    };
    if (!promotionId) return this.prisma.promotion.create({ data });
    const current = await this.prisma.promotion.findUnique({
      where: { id: id(promotionId) },
    });
    if (!current) throw new NotFoundException('Không tìm thấy ưu đãi');
    stale(current.updatedAt, b.updatedAt);
    const result = await this.prisma.promotion.updateMany({
      where: { id: promotionId, updatedAt: current.updatedAt },
      data,
    });
    if (!result.count)
      throw new ConflictException('Ưu đãi vừa được chỉnh sửa. Hãy tải lại.');
    return { ok: true };
  }
  // Translate known database conflicts; do not expose internal SQL details.
  async write<T>(action: () => Promise<T>) {
    try {
      return await action();
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      )
        throw new ConflictException('Mã đã tồn tại. Hãy dùng mã khác.');
      throw e;
    }
  }
}
