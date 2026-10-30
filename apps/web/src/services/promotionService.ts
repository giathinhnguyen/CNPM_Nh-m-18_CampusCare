import type { Promotion } from "../types";

const API_URL = import.meta.env?.VITE_API_URL ?? "http://localhost:3000/api";

export interface CartQuote {
  promotionCode: string | null;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
  items: { productSizeId: string; unitPrice: number; totalPrice: number }[];
}

export class PromotionApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface ApiPromotion extends Omit<
  Promotion,
  "discountValue" | "minOrderAmount" | "maxDiscountAmount"
> {
  discountValue: string | number;
  minOrderAmount: string | number;
  maxDiscountAmount: string | number | null;
}

export const promotionService = {
  async quote(
    code: string | null,
    items: {
      productSizeId: string;
      quantity: number;
      toppingIds?: string[];
      toppings?: { id: string }[];
    }[],
    signal?: AbortSignal,
  ): Promise<CartQuote> {
    const response = await fetch(`${API_URL}/promotions/quote`, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        items: items.map((item) => ({
          productSizeId: item.productSizeId,
          quantity: item.quantity,
          toppingIds:
            item.toppingIds ??
            item.toppings?.map((topping) => topping.id) ??
            [],
        })),
      }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new PromotionApiError(
        typeof data.message === "string"
          ? data.message
          : "Không thể kiểm tra khuyến mãi",
        response.status,
      );
    return {
      promotionCode: data.promotionCode,
      totalAmount: Number(data.totalAmount),
      discountAmount: Number(data.discountAmount),
      finalAmount: Number(data.finalAmount),
      items: data.items.map(
        (item: {
          productSizeId: string;
          unitPrice: string | number;
          totalPrice: string | number;
        }) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        }),
      ),
    };
  },
  async getPromotions(signal?: AbortSignal): Promise<Promotion[]> {
    const response = await fetch(`${API_URL}/promotions`, { signal });
    if (!response.ok)
      throw new Error(`Không thể tải khuyến mãi (${response.status})`);
    const data = (await response.json()) as ApiPromotion[];

    // Decimal của Prisma được gửi qua JSON dưới dạng chuỗi.
    return data.map((item) => ({
      ...item,
      discountValue: Number(item.discountValue),
      minOrderAmount: Number(item.minOrderAmount),
      maxDiscountAmount:
        item.maxDiscountAmount === null ? null : Number(item.maxDiscountAmount),
    }));
  },
};
