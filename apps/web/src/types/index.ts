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

export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "CANCELLED" | "EXPIRED";
