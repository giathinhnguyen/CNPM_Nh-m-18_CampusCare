import type { Product, Topping } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

interface ApiCategory {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
}

interface ApiProduct {
  id: string;
  name: string;
  description: string | null;
  basePrice: string | number;
  imageUrl: string | null;
  stockQuantity: number;
  category: {
    id: string;
    name: string;
    slug: string;
  };
  sizes: {
    id: string;
    size: "S" | "M" | "L";
    priceAdjustment: string | number;
  }[];
}

interface ApiTopping {
  id: string;
  name: string;
  price: string | number;
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API lỗi: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const catalogService = {
  async getCategories() {
    return request<ApiCategory[]>("/categories");
  },

  async getProducts(): Promise<Product[]> {
    const data = await request<ApiProduct[]>("/products");

    return data.map((item) => ({
      ...item,
      basePrice: Number(item.basePrice),
      sizes: item.sizes.map((size) => ({
        ...size,
        priceAdjustment: Number(size.priceAdjustment),
      })),
    }));
  },

  async getProductById(id: string): Promise<Product> {
    const item = await request<ApiProduct>(
      `/products/${encodeURIComponent(id)}`,
    );

    return {
      ...item,
      basePrice: Number(item.basePrice),
      sizes: item.sizes.map((size) => ({
        ...size,
        priceAdjustment: Number(size.priceAdjustment),
      })),
    };
  },

  async getToppings(): Promise<Topping[]> {
    const data = await request<ApiTopping[]>("/toppings");

    return data.map((item) => ({
      ...item,
      price: Number(item.price),
    }));
  },
};
