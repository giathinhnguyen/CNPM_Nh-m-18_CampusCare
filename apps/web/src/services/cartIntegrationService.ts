import { authenticatedFetch, TOKEN_KEY } from "./session.ts";

const API_BASE = import.meta.env?.VITE_API_URL || "http://localhost:3000/api";
const GUEST_CART_KEY = "brewlite_guest_cart";

export function getCartOwner(): string {
  try {
    const token = localStorage.getItem(TOKEN_KEY) ?? "";
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.sub === "string" ? payload.sub : "";
  } catch {
    return "";
  }
}

export const cartIntegrationService = {
  async saveSelection(
    items: { id: string; isSelected?: boolean }[],
    selectedIds: string[],
    isLoggedIn: boolean,
  ) {
    if (!isLoggedIn) {
      const current = JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? "[]");
      const knownIds = new Set(items.map((item) => item.id));
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(current.map((item: { id: string }) =>
        knownIds.has(item.id) ? { ...item, isSelected: selectedIds.includes(item.id) } : item,
      )));
      return;
    }
    const owner = getCartOwner();
    if (!owner) throw new Error("Vui lòng đăng nhập lại");
    // Tái sử dụng API PATCH từng món, không thêm API lựa chọn mới.
    const changes = items.filter((item) => (item.isSelected !== false) !== selectedIds.includes(item.id));
    const results = await Promise.allSettled(changes.map(async (item) => {
      const response = await authenticatedFetch(`${API_BASE}/cart/items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSelected: selectedIds.includes(item.id) }),
      });
      if (!response.ok) throw new Error("Không thể lưu lựa chọn món");
    }));
    if (getCartOwner() !== owner) throw new Error("Tài khoản đã thay đổi. Vui lòng tải lại giỏ");
    if (results.some((result) => result.status === "rejected")) {
      throw new Error("Chưa lưu được đầy đủ lựa chọn. Vui lòng kiểm tra giỏ đã tải lại");
    }
  },
};
