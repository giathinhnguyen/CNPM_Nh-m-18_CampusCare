import type { CartItem, Order } from "../types"

interface CheckoutPayload {
  userId: string
  items: CartItem[]
  subtotal: number
  discount: number
  paymentMethod: "wallet" | "card"
  idempotencyKey: string
  simulateFailure?: boolean
}

export type PaymentResult =
  | { ok: true; order: Order }
  | { ok: false; attempt: Omit<Order, "status"> }

const processedRequests = new Map<string, PaymentResult>()

export async function processCheckout(
  payload: CheckoutPayload,
): Promise<PaymentResult> {
  await new Promise((resolve) => setTimeout(resolve, 1400))

  const existing = processedRequests.get(payload.idempotencyKey)
  if (existing) return existing

  const attempt: Omit<Order, "status"> = {
    id: `${Math.floor(1100 + Math.random() * 800)}`,
    userId: payload.userId,
    createdAt: new Date().toISOString(),
    items: payload.items,
    subtotal: payload.subtotal,
    discount: payload.discount,
    total: Math.max(0, payload.subtotal - payload.discount),
    paymentMethod: payload.paymentMethod,
  }
  const result: PaymentResult = payload.simulateFailure
    ? { ok: false, attempt }
    : { ok: true, order: { ...attempt, status: "PAID" } }
  processedRequests.set(payload.idempotencyKey, result)
  return result
}
