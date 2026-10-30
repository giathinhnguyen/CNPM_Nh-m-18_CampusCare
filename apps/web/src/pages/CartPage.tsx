import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  LogIn,
  Minus,
  Plus,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  ButtonLink,
  EmptyState,
  ErrorState,
  InlineNotice,
  LoadingState,
  PageTitle,
  TextArea,
  TextInput,
} from "../components/ui";
import { useCartPromotion } from "../hooks/useCartPromotion";
import { cartIntegrationService } from "../services/cartIntegrationService";
import { formatCurrency } from "../lib/utils";
import { cartService } from "../services/cartService";
import { useAuth } from "../contexts/AuthContext";

// Định dạng hiển thị kích cỡ giống giao diện web mẫu
const formatSizeLabel = (size: any) => {
  if (!size) return "Size M · Vừa (500ml)";
  if (typeof size === "object") {
    const id = size.id || size.size || "M";
    const label = size.label
      ? ` · ${size.label.split(" · ")[1] || size.label}`
      : "";
    return `Size ${id}${label}`;
  }
  const sizeMap: Record<string, string> = {
    S: "Nhỏ (350ml)",
    M: "Vừa (500ml)",
    L: "Lớn (700ml)",
  };
  return `Size ${size} · ${sizeMap[size] || "Tiêu chuẩn"}`;
};

// Định dạng mức ngọt và mức đá
const formatLevel = (level: any) => {
  if (level === undefined || level === null) return "100%";
  if (typeof level === "number") return `${level}%`;
  if (typeof level === "object" && level.value !== undefined)
    return `${level.value}%`;
  switch (String(level).toUpperCase()) {
    case "ONE_TWENTY":
      return "120%";
    case "HUNDRED":
      return "100%";
    case "FIFTY":
      return "50%";
    case "ZERO":
      return "0%";
    default:
      return String(level).includes("%") ? String(level) : `${level}%`;
  }
};

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [cartItems, setCartItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [code, setCode] = useState("");
  const [loadError, setLoadError] = useState("");
  const [savingSelection, setSavingSelection] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const loadVersion = useRef(0);
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null);

  // Toast thông báo
  const [toast, setToast] = useState<{
    message: string;
    type?: "success" | "info" | "error";
  } | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (
    message: string,
    type: "success" | "info" | "error" = "success",
  ) => {
    if (toastTimeoutRef.current) window.clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // 1. Tải giỏ hàng
  const fetchCart = async (keepSelection = true) => {
    const version = ++loadVersion.current;
    try {
      setLoading(true);
      setLoadError("");
      const data = await cartService.getCart(Boolean(user));
      if (version !== loadVersion.current) return;
      const items = data.items || [];
      setCartItems(items);

      setSelectedIds((prev) => {
        if (keepSelection) {
          const currentValid = items
            .filter((item: any) => !item.isOutOfStock && !item.unavailable)
            .map((item: any) => item.id);
          const preserved = prev.filter((id) => currentValid.includes(id));
          return preserved;
        }
        return items
          .filter((item: any) => !item.isOutOfStock && !item.unavailable && item.isSelected !== false)
          .map((item: any) => item.id);
      });
    } catch (err) {
      console.error("Lỗi lấy giỏ hàng:", err);
      if (version === loadVersion.current) setLoadError(err instanceof Error ? err.message : "Không thể tải giỏ hàng");
    } finally {
      if (version === loadVersion.current) setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    void fetchCart(false).then(() => {
      // Đọc cảnh báo từ sync giỏ hàng (khi vừa đăng nhập)
      const rawWarnings = sessionStorage.getItem("brewlite_sync_warnings");
      if (rawWarnings) {
        sessionStorage.removeItem("brewlite_sync_warnings");
        try {
          const warnings: string[] = JSON.parse(rawWarnings);
          if (warnings.length > 0) {
            // Hiển thị từng cảnh báo, cách nhau 1.5 giây
            warnings.forEach((msg, idx) => {
              window.setTimeout(() => showToast(msg, "error"), idx * 1600);
            });
          }
        } catch {
          /* bỏ qua nếu lỗi parse */
        }
      }
    });
    return () => { loadVersion.current++; };
  }, [user, authLoading]);

  // Kiểm tra món hết hàng
  const isUnavailable = (item: any) =>
    Boolean(
      item.isOutOfStock ||
      item.unavailable ||
      (item.stockQuantity !== undefined && item.stockQuantity <= 0),
    );

  const availableItems = cartItems.filter((item) => !isUnavailable(item));
  const allSelected =
    availableItems.length > 0 && selectedIds.length === availableItems.length;

  const selectedItems = cartItems.filter((item) =>
    selectedIds.includes(item.id) && !isUnavailable(item),
  );
  const localSubtotal = selectedItems.reduce(
    (sum, item) => sum + (item.unitPrice || item.price || 0) * item.quantity,
    0,
  );
  const promotion = useCartPromotion(loading || authLoading || loadError ? [] : selectedItems, user?.id ?? "guest");
  const { appliedPromo, error: promoError } = promotion;
  const subtotal = promotion.quote?.totalAmount ?? localSubtotal;
  const activeDiscount = promotion.quote?.discountAmount ?? 0;
  const total = promotion.quote?.finalAmount ?? subtotal;
  const busy = savingSelection || updatingId !== null || confirming;

  const persistSelection = async (nextIds: string[]) => {
    if (busy) return;
    const version = loadVersion.current;
    setSavingSelection(true);
    try {
      await cartIntegrationService.saveSelection(cartItems, nextIds, Boolean(user));
      if (version !== loadVersion.current) return;
      setSelectedIds(nextIds);
      setCartItems((items) => items.map((item) => ({ ...item, isSelected: nextIds.includes(item.id) })));
    } catch (err) {
      if (version !== loadVersion.current) return;
      showToast(err instanceof Error ? err.message : "Không thể lưu lựa chọn", "error");
      await fetchCart(false);
    } finally {
      setSavingSelection(false);
    }
  };

  // Chọn / bỏ chọn 1 món
  const toggleItem = (id: string) => {
    void persistSelection(selectedIds.includes(id)
      ? selectedIds.filter((key) => key !== id)
      : [...selectedIds, id]);
  };

  // Chọn tất cả món còn hàng
  const toggleSelectAll = () => {
    void persistSelection(allSelected ? [] : availableItems.map((item) => item.id));
  };

  // 2. Cập nhật số lượng & Chặn khi vượt quá số lượng mua
  const handleUpdateQuantity = async (
    itemId: string,
    currentQty: number,
    delta: number,
  ) => {
    const item = cartItems.find((i) => i.id === itemId);
    if (!item) return;

    const newQty = currentQty + delta;
    if (newQty <= 0) {
      setPendingRemoval(itemId);
      return;
    }

    // CHẶN VÀ THÔNG BÁO KHI VƯỢT QUÁ SỐ LƯỢNG MUA
    if (delta > 0) {
      const stock = item.stockQuantity ?? 999;
      const totalQtyForProduct = cartItems
        .filter((i) => i.productId === item.productId)
        .reduce((sum, i) => sum + i.quantity, 0);

      if (totalQtyForProduct + delta > stock) {
        showToast(
          `Hiện số lượng tối đa của món ${item.productName || item.name || "này"} là ${stock} ly (tính cả các lựa chọn đã có trong giỏ).`,
          "error",
        );
        return;
      }
    }

    try {
      setUpdatingId(itemId);
      await cartService.updateQuantity(itemId, newQty, Boolean(user));
      setCartItems((prev) =>
        prev.map((i) =>
          i.id === itemId
            ? {
                ...i,
                quantity: newQty,
                totalPrice: (i.unitPrice || i.price || 0) * newQty,
              }
            : i,
        ),
      );
    } catch (err: any) {
      showToast(err.message || "Không thể cập nhật số lượng", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // 3. Xóa món khỏi giỏ
  const confirmRemoval = async () => {
    if (!pendingRemoval) return;
    const targetId = pendingRemoval;
    try {
      setUpdatingId(targetId);
      await cartService.removeItem(targetId, Boolean(user));
      setCartItems((prev) => prev.filter((item) => item.id !== targetId));
      setSelectedIds((prev) => prev.filter((id) => id !== targetId));
      setPendingRemoval(null);
      showToast("Đã xóa sản phẩm khỏi giỏ", "info");
    } catch (err: any) {
      showToast(err.message || "Không thể xóa món", "error");
    } finally {
      setUpdatingId(null);
    }
  };

  // 4. Cập nhật ghi chú
  const handleUpdateNote = (itemId: string, note: string) => {
    setCartItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, note } : item)),
    );
    void cartService.updateNote(itemId, note, Boolean(user));
  };

  // 5. Áp dụng mã ưu đãi
  const submitPromo = () => {
    promotion.apply(code);
  };

  // 6. Xử lý nút thanh toán
  const handleProceedToCheckout = async () => {
    if (busy || !promotion.canProceed) return;
    const version = loadVersion.current;
    setConfirming(true);
    try {
      await promotion.confirm();
      if (version !== loadVersion.current) return;
      localStorage.setItem("brewlite_checkout_selection", JSON.stringify(selectedIds));
      if (!user) {
        navigate("/login", { state: { from: "/cart" } });
        return;
      }
      showToast("Đã lưu lựa chọn và mã ưu đãi. Chức năng đặt hàng hiện chưa khả dụng.", "info");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Không thể xác nhận giá", "error");
    } finally {
      setConfirming(false);
    }
  };

  if (loading || authLoading) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <LoadingState label="Đang kiểm tra giỏ hàng của bạn..." />
      </section>
    );
  }

  if (loadError) {
    return <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <ErrorState title="Chưa tải được giỏ hàng" description={loadError}
        action={<Button onClick={() => void fetchCart(false)}>Thử lại</Button>} />
    </section>;
  }

  if (cartItems.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <EmptyState
          title="Giỏ hàng đang chờ món ngon"
          description="Bạn chưa thêm thức uống nào. Hãy khám phá menu và chọn món hợp mood hôm nay."
          action={<ButtonLink to="/#menu">Khám phá menu</ButtonLink>}
        />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-14 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageTitle
          eyebrow="Đơn hàng của bạn"
          title="Giỏ hàng"
          description={`${cartItems.length} lựa chọn đang chờ được pha mới.`}
        />
        {!user && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3.5 py-1.5 text-xs font-semibold text-amber-900 shadow-sm">
            <LogIn size={14} /> Chế độ khách vãng lai
          </span>
        )}
      </div>

      <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_25rem] lg:items-start">
        {/* DANH SÁCH MÓN */}
        <div className="space-y-4">
          {/* NÚT TIẾP TỤC MUA SẮM Ở TRÊN ĐẦU DANH SÁCH */}
          <ButtonLink to="/#menu" variant="ghost">
            <ArrowLeft size={17} /> Tiếp tục mua sắm
          </ButtonLink>

          <button
            type="button"
            onClick={toggleSelectAll}
            disabled={busy}
            className="flex items-center gap-3 rounded-xl px-1 py-2 text-sm font-semibold text-[#5f4b40] transition hover:text-[#3b241c]"
          >
            <span
              className={
                allSelected
                  ? "grid size-5 place-items-center rounded-md border border-[#648066] bg-[#648066] text-white"
                  : "grid size-5 place-items-center rounded-md border border-[#b8a79c] bg-white"
              }
            >
              {allSelected && <Check size={13} />}
            </span>
            Chọn tất cả món còn hàng ({availableItems.length})
          </button>

          {cartItems.map((item) => {
            const unavailable = isUnavailable(item);
            const isSelected = selectedIds.includes(item.id);
            const quoteIndex = selectedItems.findIndex((selected) => selected.id === item.id);
            const itemPrice = promotion.quote?.items[quoteIndex]?.unitPrice ?? item.unitPrice ?? item.price ?? 0;
            const itemImg =
              item.imageUrl ||
              item.image ||
              "https://images.unsplash.com/photo-1541167760496-1628856ab772";
            const itemName =
              item.productName || item.name || "Thức uống BrewLite";

            return (
              <article
                key={item.id}
                className="relative grid grid-cols-[5.5rem_1fr] gap-4 rounded-[1.5rem] border border-[#e3d9cf] bg-white p-3.5 pl-11 shadow-[0_10px_35px_rgba(65,42,31,0.05)] sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:p-4 sm:pl-12"
              >
                {/* CHECKBOX CHỌN MÓN */}
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  disabled={unavailable || busy}
                  className="absolute left-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9845a]/25 disabled:cursor-not-allowed disabled:opacity-40 sm:left-4"
                  aria-label={
                    isSelected ? `Bỏ chọn ${itemName}` : `Chọn ${itemName}`
                  }
                >
                  <span
                    className={
                      isSelected
                        ? "grid size-5 place-items-center rounded-md border border-[#648066] bg-[#648066] text-white"
                        : "grid size-5 place-items-center rounded-md border border-[#b8a79c] bg-white"
                    }
                  >
                    {isSelected && <Check size={13} />}
                  </span>
                </button>

                {/* HÌNH ẢNH SẢN PHẨM */}
                <img
                  src={itemImg}
                  alt={itemName}
                  className="aspect-square h-full w-full rounded-2xl object-cover"
                />

                {/* THÔNG TIN CHI TIẾT */}
                <div className="min-w-0">
                  <h2 className="font-serif text-xl text-[#302018]">
                    {itemName}
                  </h2>

                  {unavailable && (
                    <span className="mt-1.5 inline-flex rounded-full bg-[#f9e1de] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-[#8c382e]">
                      {item.availabilityMessage || "Hết hàng"}
                    </span>
                  )}

                  {item.isReward && (
                    <span className="mt-1.5 inline-flex rounded-full bg-[#e5eee3] px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wide text-[#31583b]">
                      Đổi thưởng · {item.rewardPoints?.toLocaleString("vi-VN")}{" "}
                      điểm
                    </span>
                  )}

                  <p className="mt-1 text-sm text-[#7c6a60]">
                    {formatSizeLabel(item.size)}
                  </p>

                  <p className="mt-1 truncate text-xs text-[#958379]">
                    {item.toppings?.length
                      ? item.toppings
                          .map((topping: any) => topping.name)
                          .join(", ")
                      : "Không thêm topping"}
                  </p>

                  <p className="mt-1 text-xs text-[#958379]">
                    Ngọt {formatLevel(item.sweetnessLevel ?? item.sweetness)} ·
                    Đá {formatLevel(item.iceLevel ?? item.ice)}
                  </p>

                  {/* GHI CHÚ CHO MÓN */}
                  <div className="mt-3 w-full max-w-xs">
                    <label
                      htmlFor={`note-${item.id}`}
                      className="mb-1.5 block text-xs font-semibold text-[#6f5b50]"
                    >
                      Ghi chú cho món
                    </label>
                    <TextArea
                      id={`note-${item.id}`}
                      value={item.note ?? ""}
                      onChange={(event) =>
                        handleUpdateNote(
                          item.id,
                          event.target.value.slice(0, 80),
                        )
                      }
                      placeholder="Ví dụ: Không dùng ống hút, để riêng topping..."
                      rows={1}
                      maxLength={80}
                      className="min-h-9 overflow-hidden px-3 py-1.5 text-xs [field-sizing:content]"
                    />
                    <p className="mt-1 text-right text-[0.68rem] text-[#9a887d]">
                      {(item.note ?? "").length}/80
                    </p>
                  </div>

                  {/* GIÁ TIỀN TRÊN MOBILE */}
                  <p className="mt-3 font-bold text-[#4c352a] sm:hidden">
                    {formatCurrency(itemPrice * item.quantity)}
                  </p>
                </div>

                {/* CỘT PHẢI: GIÁ & SỐ LƯỢNG & NÚT XÓA */}
                <div className="col-span-2 flex items-center justify-between border-t border-[#eee7e0] pt-3 sm:col-span-1 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                  <p className="hidden font-bold text-[#4c352a] sm:block">
                    {formatCurrency(itemPrice * item.quantity)}
                  </p>

                  <div className="flex items-start gap-2 sm:mt-4">
                    <div className="flex flex-col items-center gap-2">
                      {/* BỘ TĂNG GIẢM SỐ LƯỢNG */}
                      <div className="flex items-center rounded-full border border-[#ddd2c8] p-0.5">
                        <button
                          type="button"
                          className="grid size-8 place-items-center rounded-full hover:bg-[#eee6dc] disabled:opacity-40"
                          onClick={() =>
                            handleUpdateQuantity(item.id, item.quantity, -1)
                          }
                          disabled={
                            item.quantity === 1 ||
                            unavailable ||
                            busy
                          }
                          aria-label={`Giảm số lượng ${itemName}`}
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-7 text-center text-sm font-bold text-[#35241d]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          className="grid size-8 place-items-center rounded-full hover:bg-[#eee6dc] disabled:opacity-40"
                          onClick={() =>
                            handleUpdateQuantity(item.id, item.quantity, 1)
                          }
                          disabled={
                            item.isReward ||
                            unavailable ||
                            busy
                          }
                          aria-label={`Tăng số lượng ${itemName}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>

                      {/* ĐƠN GIÁ THEO LY */}
                      {item.quantity >= 2 && (
                        <p className="text-xs text-[#7e6b60]">
                          Đơn giá {formatCurrency(itemPrice)}/ly
                        </p>
                      )}
                    </div>

                    {/* NÚT XÓA MÓN */}
                    <button
                      type="button"
                      className="grid size-9 place-items-center rounded-full text-[#9b4a40] hover:bg-[#fff0ed]"
                      onClick={() => setPendingRemoval(item.id)}
                      disabled={busy}
                      aria-label={`Xóa ${itemName}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>

        {/* TÓM TẮT ĐƠN HÀNG */}
        <aside className="rounded-[1.75rem] border border-[#e0d5cb] bg-white p-5 shadow-[0_14px_45px_rgba(65,42,31,0.07)] lg:sticky lg:top-24 lg:p-6">
          <h2 className="font-serif text-2xl text-[#302018]">
            Tóm tắt đơn hàng
          </h2>

          <div className="mt-5 flex gap-2">
            <TextInput
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Mã ưu đãi"
              aria-label="Mã ưu đãi"
              icon={<Tag size={17} />}
            />
            <Button variant="secondary" onClick={submitPromo} disabled={busy || promotion.pending}>
              Áp dụng
            </Button>
          </div>

          {promoError && (
            <div className="mt-3">
              <InlineNotice type="error">{promoError}</InlineNotice>
            </div>
          )}

          {promotion.pending && <p className="mt-3 text-sm text-[#7c6a60]">Đang kiểm tra giá và ưu đãi...</p>}

          {promoError && <Button variant="ghost" onClick={promotion.retry} disabled={busy}>Kiểm tra lại</Button>}

          {appliedPromo && <Button variant="ghost" onClick={promotion.remove} disabled={busy}>Bỏ mã {appliedPromo}</Button>}

          {promotion.quote?.promotionCode && !promoError && (
            <div className="mt-3">
              <InlineNotice>Đã áp dụng mã {appliedPromo}</InlineNotice>
            </div>
          )}

          <div className="my-6 h-px bg-[#ece4dc]" />

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between text-[#76645a]">
              <dt>Tạm tính</dt>
              <dd>{formatCurrency(subtotal)}</dd>
            </div>
            <div className="flex justify-between text-[#59715a]">
              <dt>Giảm giá</dt>
              <dd>-{formatCurrency(activeDiscount)}</dd>
            </div>
          </dl>

          <div className="my-5 h-px bg-[#ece4dc]" />

          <div className="flex items-end justify-between">
            <span className="font-semibold text-[#302018]">
              Tổng thanh toán
            </span>
            <span className="text-xl font-bold text-[#3b281f]">
              {formatCurrency(total)}
            </span>
          </div>

          <Button
            fullWidth
            size="lg"
            className="mt-6"
            disabled={!promotion.canProceed || busy}
            onClick={handleProceedToCheckout}
          >
            {!user
              ? "Đăng nhập để thanh toán"
              : `Thanh toán ${selectedIds.length > 0 ? `${selectedIds.length} món` : ""}`}
          </Button>

          <p className="mt-3 text-center text-xs leading-5 text-[#958278]">
            Số tiền cuối cùng sẽ được xác nhận lại khi đặt hàng.
          </p>
        </aside>
      </div>

      {/* MODAL XÁC NHẬN XÓA MÓN */}
      {pendingRemoval && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#241710]/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-title"
        >
          <div className="w-full max-w-sm rounded-[2rem] bg-white p-6 shadow-2xl">
            <h2
              id="remove-title"
              className="font-serif text-2xl text-[#302018]"
            >
              Xóa món khỏi giỏ?
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#7a685e]">
              Bạn có thể quay lại menu để thêm món này vào sau.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setPendingRemoval(null)}>
                Giữ lại
              </Button>
              <Button variant="danger" onClick={confirmRemoval}>
                Xóa sản phẩm
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST THÔNG BÁO ĐỒNG BỘ FIGMA / GIAO DIỆN MẪU */}
      {toast && (
        <div
          className="fixed right-4 top-20 z-50 flex max-w-sm items-start gap-2.5 rounded-2xl border p-3.5 text-left text-xs font-medium leading-5 shadow-xl backdrop-blur transition-all"
          style={{
            borderColor:
              toast.type === "error"
                ? "#efc3bd"
                : toast.type === "info"
                  ? "#ddd2c8"
                  : "#b9d0b9",
            backgroundColor:
              toast.type === "error"
                ? "rgba(255, 242, 240, 0.95)"
                : toast.type === "info"
                  ? "rgba(255, 255, 255, 0.95)"
                  : "rgba(237, 245, 236, 0.95)",
            color:
              toast.type === "error"
                ? "#8c382e"
                : toast.type === "info"
                  ? "#49372e"
                  : "#31583b",
          }}
          role="status"
        >
          <span className="min-w-0 flex-1 break-words">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="mt-0.5 shrink-0 opacity-70 hover:opacity-100"
            aria-label="Đóng thông báo"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </section>
  );
}
