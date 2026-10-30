import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import type { QuotePromotionDto } from './dto/quote-promotion.dto.js';

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  // Quảng bá kết thúc không làm mã hết hạn; chỉ xét cấu hình của mã.
  async findAll() {
    return this.prisma.promotion.findMany({
      where: this.activeWhere(new Date()),
      select: {
        id: true,
        code: true,
        title: true,
        description: true,
        discountType: true,
        discountValue: true,
        minOrderAmount: true,
        maxDiscountAmount: true,
        startDate: true,
        endDate: true,
        appliesToAllProducts: true,
        products: {
          select: { product: { select: { id: true, name: true } } },
          orderBy: { product: { name: 'asc' } },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { code: 'asc' }],
    });
  }

  // Tính thử, không lưu mã vào đơn và không đánh dấu khách đã dùng mã.
  async quote(body: unknown) {
    const input = this.validateQuote(body);

    // Đọc mã, giá món và topping từ cùng một ảnh chụp dữ liệu.
    return this.prisma.$transaction((tx) => this.calculateQuote(tx, input), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }

  // Khi tạo đơn, gọi lại trong transaction của đơn; không tin kết quả từ frontend.
  async calculateQuote(tx: Prisma.TransactionClient, body: unknown) {
    const input = this.validateQuote(body);
    const promotion = input.code
      ? await tx.promotion.findFirst({
          where: { code: input.code, ...this.activeWhere(new Date()) },
          include: { products: { select: { productId: true } } },
        })
      : null;

    if (input.code && !promotion) {
      throw new NotFoundException(
        'Mã khuyến mãi không tồn tại hoặc không còn hiệu lực',
      );
    }

    const sizeIds = [...new Set(input.items.map((item) => item.productSizeId))];
    const toppingIds = [
      ...new Set(input.items.flatMap((item) => item.toppingIds)),
    ];
    const [sizes, toppings] = await Promise.all([
      tx.productSize.findMany({
        where: {
          id: { in: sizeIds },
          isActive: true,
          product: { isActive: true, category: { isActive: true } },
        },
        include: {
          product: {
            select: { id: true, basePrice: true, stockQuantity: true },
          },
        },
      }),
      tx.topping.findMany({
        where: { id: { in: toppingIds }, isActive: true },
      }),
    ]);

    if (
      sizes.length !== sizeIds.length ||
      toppings.length !== toppingIds.length
    ) {
      throw new BadRequestException(
        'Món, kích thước hoặc topping không còn khả dụng',
      );
    }

    const sizeMap = new Map(sizes.map((size) => [size.id, size]));
    const toppingMap = new Map(
      toppings.map((topping) => [topping.id, topping.price]),
    );
    const eligibleIds = new Set(
      promotion?.products.map((item) => item.productId) ?? [],
    );
    let totalAmount = new Prisma.Decimal(0);
    let eligibleAmount = new Prisma.Decimal(0);
    const quantities = new Map<string, number>();
    const pricedItems: {
      productSizeId: string;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
    }[] = [];

    for (const item of input.items) {
      const size = sizeMap.get(item.productSizeId)!;
      const toppingAmount = item.toppingIds.reduce(
        (sum, id) => sum.plus(toppingMap.get(id)!),
        new Prisma.Decimal(0),
      );
      const unitPrice = size.product.basePrice
        .plus(size.priceAdjustment)
        .plus(toppingAmount);
      const lineAmount = unitPrice.times(item.quantity);
      const quantity = (quantities.get(size.product.id) ?? 0) + item.quantity;
      if (quantity > size.product.stockQuantity) {
        throw new BadRequestException(
          'Số lượng món được chọn vượt tồn kho. Vui lòng kiểm tra lại giỏ hàng',
        );
      }
      quantities.set(size.product.id, quantity);
      pricedItems.push({
        productSizeId: size.id,
        unitPrice,
        totalPrice: lineAmount,
      });

      if (lineAmount.isNegative()) {
        throw new BadRequestException('Giá món không hợp lệ');
      }

      totalAmount = totalAmount.plus(lineAmount);
      if (
        promotion &&
        (promotion.appliesToAllProducts || eligibleIds.has(size.product.id))
      ) {
        eligibleAmount = eligibleAmount.plus(lineAmount);
      }
    }

    if (totalAmount.greaterThan('999999999999')) {
      throw new BadRequestException('Giá trị đơn vượt giới hạn lưu trữ');
    }
    if (promotion && totalAmount.lessThan(promotion.minOrderAmount)) {
      throw new BadRequestException(
        `Đơn hàng chưa đạt giá trị tối thiểu ${promotion.minOrderAmount.toFixed(0)}đ`,
      );
    }
    if (promotion && eligibleAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Đơn hàng không có sản phẩm được áp dụng mã',
      );
    }

    let discountAmount = !promotion
      ? new Prisma.Decimal(0)
      : promotion.discountType === 'PERCENTAGE'
        ? eligibleAmount.times(promotion.discountValue).dividedBy(100)
        : promotion.discountValue;

    // Làm tròn một lần trên tổng tiền giảm, không làm tròn theo từng món.
    discountAmount = discountAmount.toDecimalPlaces(
      0,
      Prisma.Decimal.ROUND_HALF_UP,
    );
    if (promotion && promotion.maxDiscountAmount !== null) {
      discountAmount = Prisma.Decimal.min(
        discountAmount,
        promotion.maxDiscountAmount,
      );
    }
    // Giảm cố định cũng không được vượt giá trị các món áp dụng.
    discountAmount = Prisma.Decimal.min(discountAmount, eligibleAmount);

    return {
      promotionId: promotion?.id ?? null,
      promotionCode: promotion?.code ?? null,
      totalAmount,
      eligibleAmount,
      discountAmount,
      finalAmount: totalAmount.minus(discountAmount),
      items: pricedItems,
    };
  }

  private activeWhere(now: Date): Prisma.PromotionWhereInput {
    return {
      isActive: true,
      AND: [
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    };
  }

  private validateQuote(body: unknown): QuotePromotionDto {
    const isObject = (value: unknown): value is Record<string, unknown> =>
      typeof value === 'object' && value !== null && !Array.isArray(value);
    const isUuid = (value: unknown): value is string =>
      typeof value === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        value,
      );

    if (
      !isObject(body) ||
      Object.keys(body).some((key) => !['code', 'items'].includes(key)) ||
      (body.code !== undefined &&
        body.code !== null &&
        (typeof body.code !== 'string' ||
          !body.code.trim() ||
          body.code.trim().length > 50)) ||
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      throw new BadRequestException(
        'Chỉ gửi một mã khuyến mãi và danh sách món hợp lệ',
      );
    }

    const items = body.items.map((item: unknown) => {
      if (
        !isObject(item) ||
        Object.keys(item).some(
          (key) => !['productSizeId', 'quantity', 'toppingIds'].includes(key),
        ) ||
        !isUuid(item.productSizeId) ||
        typeof item.quantity !== 'number' ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        throw new BadRequestException(
          'Mỗi món cần ID kích thước và số lượng nguyên dương',
        );
      }
      const toppingIds: unknown =
        item.toppingIds === undefined ? [] : item.toppingIds;
      if (!Array.isArray(toppingIds) || !toppingIds.every(isUuid)) {
        throw new BadRequestException('Danh sách topping không hợp lệ');
      }
      const normalizedIds = toppingIds.map((id: string) => id.toLowerCase());
      if (new Set(normalizedIds).size !== normalizedIds.length) {
        throw new BadRequestException(
          'Không được gửi trùng topping trong cùng một món',
        );
      }
      return {
        productSizeId: item.productSizeId.toLowerCase(),
        quantity: item.quantity,
        toppingIds: normalizedIds,
      };
    });

    return {
      code:
        typeof body.code === 'string' ? body.code.trim().toUpperCase() : null,
      items,
    };
  }
}
