import type { DrinkLevel, OrderStatus } from "../types";

// Định dạng số tiền sang VND
export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

// Định dạng ngày giờ
export const formatDate = (date: string) =>
  new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));

// Tạo khóa cho một cấu hình sản phẩm trong giỏ hàng
export const createCartKey = (
  productId: string,
  productSizeId: string,
  toppingIds: string[],
  sweetness: DrinkLevel,
  ice: DrinkLevel,
  note = "",
) => {
  return JSON.stringify({
    productId,
    productSizeId,
    toppingIds: [...toppingIds].sort(),
    sweetness,
    ice,
    note,
  });
};

// Tính tổng số lượng sản phẩm trong giỏ hàng
export const getCartCount = (items: { quantity: number }[]) =>
  items.reduce((total, item) => total + item.quantity, 0);

// Tính tạm tính để hiển thị trên giao diện
export const getCartSubtotal = (
  items: { unitPrice: number; quantity: number }[],
) => items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);

// Nhãn trạng thái đơn hàng theo Prisma
export const statusLabels: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn thanh toán",
};

export const cx = (
  ...classes: Array<string | false | null | undefined>
): string => classes.filter(Boolean).join(" ");
