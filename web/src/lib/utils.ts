import type {
  CartItem,
  DrinkLevel,
  OrderStatus,
  SizeOption,
  Topping,
} from "../types"

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value)

export const formatDate = (date: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))

export const createCartKey = (
  productId: string,
  size: SizeOption,
  toppings: Topping[],
  sweetness: DrinkLevel,
  ice: DrinkLevel,
) =>
  `${productId}-${size.id}-${toppings
    .map((item) => item.id)
    .sort()
    .join(".")}-sweet-${sweetness.value}-ice-${ice.value}`

export const getCartSubtotal = (items: CartItem[]) =>
  items.reduce((total, item) => total + item.unitPrice * item.quantity, 0)

export const getCartCount = (items: CartItem[]) =>
  items.reduce((total, item) => total + item.quantity, 0)

export const statusLabels: Record<OrderStatus, string> = {
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
}
