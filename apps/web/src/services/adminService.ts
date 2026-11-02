import { authenticatedFetch } from "./session";
const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: "ADMIN";
}
export interface Ingredient {
  id: string;
  code: string;
  name: string;
  unit: string;
  unitCostVnd: string;
  reorderLevel: string;
  isActive: boolean;
  updatedAt: string;
  stock: { onHand: string; reserved: string; updatedAt: string } | null;
}
export interface RecipeRow {
  ingredientId: string;
  quantity: string;
  adjustmentGroup: "FIXED" | "SUGAR";
  ingredient: Ingredient;
}
export interface AdminSize {
  id: string;
  size: string;
  priceAdjustment: string;
  cupVolumeMl: number | null;
  updatedAt: string;
  ingredients: RecipeRow[];
}
export interface AdminProduct {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: string;
  isActive: boolean;
  categoryId: string;
  category: { name: string };
  updatedAt: string;
  sizes: AdminSize[];
}
export interface AdminPromotion {
  id: string;
  code: string;
  title: string | null;
  description: string | null;
  discountType: "FIXED" | "PERCENTAGE";
  discountValue: string;
  minOrderAmount: string;
  maxDiscountAmount: string | null;
  isActive: boolean;
  startDate: string | null;
  endDate: string | null;
  updatedAt: string;
  appliesToAllProducts: boolean;
}
export interface AdminCustomer {
  id: string;
  fullName: string;
  email: string;
  loyaltyPoints: number;
  reservedPoints: number;
  createdAt: string;
  _count: { orders: number };
}
export interface AdminData {
  ingredients: Ingredient[];
  products: AdminProduct[];
  promotions: AdminPromotion[];
  customers: AdminCustomer[];
  categories: { id: string; name: string }[];
}
export interface CustomerOrder {
  payments: { transactionId: string | null; status: string }[];
  id: string;
  orderCode: string;
  status: string;
  finalAmount: string;
  createdAt: string;
  items: { productName: string; quantity: number }[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await authenticatedFetch(`${API}${path}`, {
    ...init,
    headers,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof data?.message === "string"
        ? data.message
        : "Không thể tải dữ liệu. Vui lòng thử lại.",
    );
  }
  return data as T;
}
export const adminService = {
  me: () => request<AdminUser>("/admin/me"),
  overview: () => request<AdminData>("/admin/overview"),
  orders: (id: string) =>
    request<CustomerOrder[]>(`/admin/customers/${id}/orders`),
  save: (section: string, id: string | null, body: unknown) =>
    request(`/admin/${section}${id ? `/${id}` : ""}`, {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(body),
    }),
  recipe: (id: string, body: unknown) =>
    request(`/admin/sizes/${id}/recipe`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
};
