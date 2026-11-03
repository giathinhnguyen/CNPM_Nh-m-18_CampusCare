export const GUEST_CART_KEY = "brewlite_guest_cart";
const PENDING_SYNC_KEY = "brewlite_guest_cart_sync";
let inFlight: { owner: string; promise: Promise<unknown> } | null = null;

// Giữ snapshot và syncId đến khi server xác nhận; retry gửi lại đúng lô cũ.
export async function syncGuestCart(
  owner: string,
  send: (body: unknown) => Promise<Response>,
  currentOwner: () => string,
) {
  if (inFlight) {
    if (inFlight.owner !== owner)
      throw new Error("Đang đồng bộ giỏ của tài khoản khác. Vui lòng thử lại");
    return inFlight.promise;
  }
  const run = async () => {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    const pending = localStorage.getItem(PENDING_SYNC_KEY);
    if (!raw && !pending) return;
    const items = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(items))
      throw new Error("Dữ liệu giỏ khách không hợp lệ");
    const batch = pending
      ? JSON.parse(pending)
      : { owner, syncId: crypto.randomUUID(), items };
    if (batch.owner !== owner)
      throw new Error(
        "Giỏ khách đang chờ đồng bộ với tài khoản trước. Vui lòng đăng nhập lại tài khoản đó",
      );
    if (batch.items.length === 0) return;
    localStorage.setItem(PENDING_SYNC_KEY, JSON.stringify(batch));
    const response = await send({ syncId: batch.syncId, items: batch.items });
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        typeof data.message === "string"
          ? data.message
          : "Không thể đồng bộ giỏ khách. Dữ liệu vẫn được giữ để thử lại",
      );
    if (currentOwner() !== owner)
      throw new Error(
        "Tài khoản đã thay đổi trong khi đồng bộ. Dữ liệu vẫn được giữ",
      );

    // Không làm mất các món mới được thêm từ tab khác trong lúc gửi request.
    const latest = JSON.parse(localStorage.getItem(GUEST_CART_KEY) ?? "[]");
    const remaining = latest
      .map((item: { id: string; quantity: number; unitPrice: number }) => {
        const sent = batch.items.find(
          (entry: { id: string }) => entry.id === item.id,
        );
        return sent
          ? {
              ...item,
              quantity: Math.max(0, item.quantity - sent.quantity),
              totalPrice:
                item.unitPrice * Math.max(0, item.quantity - sent.quantity),
            }
          : item;
      })
      .filter((item: { quantity: number }) => item.quantity > 0);
    if (remaining.length)
      localStorage.setItem(GUEST_CART_KEY, JSON.stringify(remaining));
    else localStorage.removeItem(GUEST_CART_KEY);
    localStorage.removeItem(PENDING_SYNC_KEY);
    return data;
  };
  const promise = run();
  inFlight = { owner, promise };
  try {
    return await promise;
  } finally {
    if (inFlight?.promise === promise) inFlight = null;
  }
}
