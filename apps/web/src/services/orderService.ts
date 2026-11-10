import { authenticatedFetch } from "./session";
import type { DrinkLevel, OrderStatus } from "../types";
const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";
export interface CheckoutItem {
  id: string;
  productSizeId: string;
  productName: string;
  imageUrl: string | null;
  size: string;
  sweetnessLevel: DrinkLevel;
  iceLevel: DrinkLevel;
  quantity: number;
  note: string | null;
  unitPrice: number;
  totalPrice: number;
  isReward: boolean;
  rewardPoints: number | null;
  toppings: { id: string; name: string; price: number }[];
}
export type BankQrDetails =
  | { configured: false }
  | {
      configured: true;
      bankBin: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
      amount: string;
      content: string;
      qrUrl: string;
    };
export interface Order {
  id: string;
  orderCode: string;
  status: OrderStatus;
  createdAt: string;
  reservationExpiresAt: string;
  customerName: string;
  customerPhone: string;
  note: string | null;
  promotionCode: string | null;
  totalAmount: string;
  discountAmount: string;
  finalAmount: string;
  inventoryStatus: string;
  items: {
    id: string;
    productName: string;
    product: { imageUrl: string | null };
    size: string;
    quantity: number;
    sweetnessLevel: DrinkLevel;
    iceLevel: DrinkLevel;
    note: string | null;
    totalPrice: string;
    rewardPoints: number | null;
    toppings: { toppingName: string }[];
  }[];
  payments: {
    id: string;
    status: string;
    needsReview: boolean;
    paymentMethod: string;
    transactionId: string | null;
  }[];
  loyaltyTxs: { type: string; pointsChange: number }[];
}
export class OrderApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await authenticatedFetch(
    `${API}${path}`,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new OrderApiError(
      data.message || "Không thể xử lý yêu cầu",
      response.status,
    );
  return data as T;
}
export const orderService = {
  create: (body: unknown) => request<Order>("/orders", body),
  list: () => request<Order[]>("/orders"),
  forPayment: (id: string) =>
    request<Order>(`/payments/${encodeURIComponent(id)}/order`),
  vnpayReturn: (params: Record<string, string>) =>
    request<Order>("/payments/vnpay/return", params),
  get: (id: string) => request<Order>(`/orders/${encodeURIComponent(id)}`),
  cancel: (id: string) =>
    request<Order>(`/payments/orders/${encodeURIComponent(id)}/cancel`, {}),
  reconcile: (id: string) =>
    request<Order>(`/payments/orders/${encodeURIComponent(id)}/reconcile`, {}),
  confirmBankTransferDemo: (id: string) =>
    request<Order>(
      `/payments/orders/${encodeURIComponent(id)}/bank-transfer-demo/confirm`,
      {},
    ),
  pay: (orderId: string, idempotencyKey: string, channel: string) =>
    request<{ paymentUrl: string | null; status: string }>("/payments", {
      orderId,
      idempotencyKey,
      channel,
    }),
  bankQr: (id: string) =>
    request<BankQrDetails>(
      `/payments/orders/${encodeURIComponent(id)}/bank-qr`,
    ),
  zalopayQr: (id: string) => request<{ qrDataUrl: string; paymentUrl: string; amount: string; expiresAt: string }>(
    `/payments/orders/${encodeURIComponent(id)}/zalopay-qr`,
  ),
  failBankTransferDemo: (id: string, idempotencyKey: string) =>
    request<Order>(
      `/payments/orders/${encodeURIComponent(id)}/bank-transfer-demo/fail`,
      { idempotencyKey },
    ),
  retry: (id: string) => request<Order>(`/payments/orders/${encodeURIComponent(id)}/retry`, {}),
  config: () =>
    request<{
      configured: boolean;
      zalopayConfigured: boolean;
      zalopaySandbox: boolean;
      bankTransferDemoEnabled: boolean;
      cardDemoEnabled: boolean;
      bankQrConfigured: boolean;
    }>("/payments/config"),
};
export const drinkPercent: Record<DrinkLevel, number> = {
  ZERO: 0,
  FIFTY: 50,
  HUNDRED: 100,
  ONE_TWENTY: 120,
};
