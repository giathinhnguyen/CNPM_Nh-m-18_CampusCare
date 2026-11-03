export interface Promotion {
  code: string;
  title: string;
  description: string;
  valueLabel: string;
  minSpend: number;
  maxDiscount?: number;
  discountType: "percentage" | "fixed";
  discountValue: number;
}

export const promotions: Promotion[] = [
  {
    code: "BREW10",
    title: "Nhẹ ví cho mọi mood",
    description: "Giảm 10% cho toàn bộ thức uống trong menu.",
    valueLabel: "Giảm 10%",
    minSpend: 0,
    maxDiscount: 50000,
    discountType: "percentage",
    discountValue: 10,
  },
  {
    code: "PICKUP15",
    title: "Đặt trước, ghé lấy liền",
    description: "Ưu đãi riêng cho đơn nhận tại quán từ 150.000đ.",
    valueLabel: "Giảm 15%",
    minSpend: 150000,
    maxDiscount: 40000,
    discountType: "percentage",
    discountValue: 15,
  },
  {
    code: "MOOD20K",
    title: "Thêm món, thêm vui",
    description: "Giảm ngay 20.000đ khi hóa đơn đạt từ 120.000đ.",
    valueLabel: "Giảm 20K",
    minSpend: 120000,
    discountType: "fixed",
    discountValue: 20000,
  },
];

export function getPromotion(code: string) {
  const normalized = code.trim().toUpperCase();
  return promotions.find((promotion) => promotion.code === normalized);
}

export function getPromotionDiscount(code: string | null, subtotal: number) {
  if (!code) return 0;

  const promotion = getPromotion(code);
  if (!promotion || subtotal < promotion.minSpend) return 0;

  const discount =
    promotion.discountType === "percentage"
      ? Math.round(subtotal * (promotion.discountValue / 100))
      : promotion.discountValue;

  return promotion.maxDiscount
    ? Math.min(discount, promotion.maxDiscount)
    : discount;
}
