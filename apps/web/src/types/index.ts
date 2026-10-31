export interface ProductSize {
  id: string;
  size: "S" | "M" | "L";
  priceAdjustment: number;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  basePrice: number;
  imageUrl: string | null;
  stockQuantity: number;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  sizes: ProductSize[];
}

export interface Topping {
  id: string;
  name: string;
  price: number;
}

export type DrinkLevel = "ZERO" | "FIFTY" | "HUNDRED" | "ONE_TWENTY";

export interface Promotion {
  id: string;
  code: string;
  title: string | null;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  startDate: string | null;
  endDate: string | null;
  appliesToAllProducts: boolean;
  products: { product: { id: string; name: string } }[];
}

export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "CANCELLED" | "EXPIRED";
