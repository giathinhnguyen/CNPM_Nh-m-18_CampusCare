import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Check,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  Landmark,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  ButtonLink,
  InlineNotice,
  LoadingState,
  PageTitle,
  TextInput,
} from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { formatCurrency } from "../lib/utils";
import { normalizeCheckoutPhone } from "../lib/checkoutPhone";
import { APPLIED_PROMO_KEY } from "../hooks/useCartPromotion";
import { cartService } from "../services/cartService";
import { promotionService, type CartQuote } from "../services/promotionService";
import {
  drinkPercent,
  OrderApiError,
  orderService,
  type CheckoutItem,
} from "../services/orderService";

export default function CheckoutPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [method, setMethod] = useState("card");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [configured, setConfigured] = useState(false);
  const [bankDemo, setBankDemo] = useState(false);
  const requestKey = useRef(crypto.randomUUID());
  const submitting = useRef(false);
  const [uncertain, setUncertain] = useState(false);
  const pendingBody = useRef<Record<string, unknown> | null>(null);
  const storageKey = `brewlite_checkout_attempt:${user?.id}`;
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const saved = sessionStorage.getItem(storageKey);
        if (saved) {
          pendingBody.current = JSON.parse(saved);
          requestKey.current = String(
            pendingBody.current!.idempotencyKey,
          ) as `${string}-${string}-${string}-${string}-${string}`;
          setUncertain(true);
        }
        const [cart, config] = await Promise.all([
          cartService.getCart(true),
          orderService.config(),
        ]);
        const ids = JSON.parse(
          localStorage.getItem("brewlite_checkout_selection") ?? "[]",
        ) as string[];
        const selected = (cart.items as CheckoutItem[]).filter((i) =>
          ids.includes(i.id),
        );
        if (!active) return;
        setConfigured(config.configured);
        setBankDemo(config.bankTransferDemoEnabled);
        setMethod(
          config.bankTransferDemoEnabled
            ? "bank-demo"
            : "card",
        );
        setItems(selected);
        if (selected.length)
          setQuote(
            await promotionService.quote(
              localStorage.getItem(APPLIED_PROMO_KEY),
              selected,
            ),
          );
        else if (!saved)
          setError("Chưa có món được chọn. Vui lòng quay lại giỏ hàng.");
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Không thể tải thông tin thanh toán",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [storageKey]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting.current || (!quote && !pendingBody.current)) return;
    const form = new FormData(event.currentTarget);
    const phone = normalizeCheckoutPhone(
      String(pendingBody.current?.customerPhone ?? form.get("phone") ?? ""),
    );
    if (!phone && !pendingBody.current) {
      setPhoneError(
        "Nhập 10 chữ số bắt đầu bằng 0 hoặc dạng +84, ví dụ 0912345678.",
      );
      document.getElementById("checkout-phone")?.focus();
      return;
    }
    setPhoneError("");
    submitting.current = true;
    setBusy(true);
    setError("");
    const body = pendingBody.current ?? {
      itemIds: items.map((i) => i.id),
      code: quote?.promotionCode,
      expectedAmount: quote?.finalAmount,
      customerName: String(form.get("name")),
      customerPhone: phone,
      note: String(form.get("note")),
      idempotencyKey: requestKey.current,
    };
    pendingBody.current = body;
    sessionStorage.setItem(storageKey, JSON.stringify(body));
    try {
      const order = await orderService.create(body);
      sessionStorage.removeItem(storageKey);
      pendingBody.current = null;
      requestKey.current = crypto.randomUUID();
      setUncertain(false);
      localStorage.removeItem("brewlite_checkout_selection");
      sessionStorage.setItem(`brewlite_payment_order:${user!.id}`, order.id);
      window.dispatchEvent(new Event("cart-updated"));
      if (order.status === "PAID") {
        navigate(`/orders/${order.id}/confirmation`, { replace: true });
        return;
      }
      if (order.status !== "PENDING_PAYMENT") {
        navigate(`/orders/${order.id}`, { replace: true });
        return;
      }
      if (method === "bank-demo") {
        navigate(`/orders/${order.id}?method=${method}`, { replace: true });
        return;
      }
      try {
        const payment = await orderService.pay(
          order.id,
          crypto.randomUUID(),
          method,
        );
        if (payment.paymentUrl) window.location.assign(payment.paymentUrl);
        else navigate(`/orders/${order.id}`, { replace: true });
      } catch {
        navigate(`/orders/${order.id}`, { replace: true });
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Chưa xác định được kết quả. Kiểm tra lại với cùng yêu cầu.",
      );
      if (
        cause instanceof OrderApiError &&
        cause.status >= 400 &&
        cause.status < 500
      ) {
        sessionStorage.removeItem(storageKey);
        pendingBody.current = null;
        setUncertain(false);
        requestKey.current = crypto.randomUUID();
        try {
          setQuote(
            await promotionService.quote(
              localStorage.getItem(APPLIED_PROMO_KEY),
              items,
            ),
          );
        } catch {
          setQuote(null);
        }
      } else setUncertain(true);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  if (loading)
    return <LoadingState label="Đang kiểm tra giá và nguyên liệu..." />;
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-14 lg:px-8">
      <ButtonLink to="/cart" variant="ghost">
        <ArrowLeft size={17} /> Quay lại giỏ hàng
      </ButtonLink>
      <div className="mt-5">
        <PageTitle
          eyebrow="Bước cuối cùng"
          title="Xác nhận & thanh toán"
          description="Kiểm tra thông tin một lần nữa trước khi BrewLite bắt đầu pha món."
        />
      </div>
      <form
        onSubmit={submit}
        className="mt-9 grid gap-8 lg:grid-cols-[1fr_25rem] lg:items-start"
      >
        <div className="space-y-6">
          <section className="rounded-[1.75rem] border border-[#e2d8ce] bg-white p-5 md:p-7">
            <h2 className="font-serif text-2xl text-[#302018]">
              Thông tin khách hàng
            </h2>
            <fieldset
              disabled={busy || uncertain}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              <div className="space-y-2 text-sm font-semibold">
                <label htmlFor="checkout-name">Họ và tên *</label>
                <TextInput
                  id="checkout-name"
                  name="name"
                  defaultValue={String(
                    pendingBody.current?.customerName ?? user?.fullName ?? "",
                  )}
                  maxLength={100}
                  required={!uncertain}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2 text-sm font-semibold">
                <label htmlFor="checkout-phone">Số điện thoại *</label>
                <TextInput
                  id="checkout-phone"
                  name="phone"
                  defaultValue={String(
                    pendingBody.current?.customerPhone ?? "",
                  )}
                  type="tel"
                  placeholder="0901 234 567"
                  maxLength={40}
                  aria-invalid={Boolean(phoneError)}
                  aria-describedby={
                    phoneError ? "checkout-phone-help" : undefined
                  }
                  onChange={() => setPhoneError("")}
                  required={!uncertain}
                  autoComplete="tel"
                />
                {phoneError && (
                  <p
                    id="checkout-phone-help"
                    role="alert"
                    className="text-xs font-normal text-red-700"
                  >
                    {phoneError}
                  </p>
                )}
              </div>
              <div className="space-y-2 text-sm font-semibold sm:col-span-2">
                <label htmlFor="checkout-note">Ghi chú cho quán</label>
                <TextInput
                  id="checkout-note"
                  name="note"
                  defaultValue={String(pendingBody.current?.note ?? "")}
                  maxLength={255}
                  placeholder="Ví dụ: Mình sẽ đến nhận lúc 10 giờ..."
                />
              </div>
            </fieldset>
          </section>
          <section className="rounded-[1.75rem] border border-[#e2d8ce] bg-white p-5 md:p-7">
            <h2 className="font-serif text-2xl text-[#302018]">
              Phương thức thanh toán
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                ...(bankDemo
                  ? [
                      {
                        id: "bank-demo",
                        title: "Chuyển khoản ngân hàng",
                        detail: "Demo đồ án · khách tự xác nhận",
                        icon: Landmark,
                      },
                    ]
                  : []),
                {
                  id: "card",
                  title: "Thẻ ngân hàng",
                  detail: "Thẻ nội địa qua VNPay",
                  icon: CreditCard,
                },
              ]
                .filter(
                  (option) =>
                    option.id === "bank-demo" ||
                    configured,
                )
                .map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={busy}
                    aria-pressed={method === option.id}
                    onClick={() => setMethod(option.id)}
                    className={`relative flex min-h-24 items-center gap-4 rounded-2xl border p-4 text-left ${method === option.id ? "border-[#5d765e] bg-[#edf3eb]" : "border-[#ded4ca]"}`}
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-[#51392e] shadow-sm">
                      <option.icon size={21} />
                    </span>
                    <span>
                      <span className="block font-semibold">
                        {option.title}
                      </span>
                      <span className="mt-1 block text-xs text-[#837167]">
                        {option.detail}
                      </span>
                    </span>
                    {method === option.id && (
                      <Check
                        size={15}
                        className="absolute right-3 top-3 text-[#658066]"
                      />
                    )}
                  </button>
                ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-[#837167]">
              {method === "bank-demo"
                ? "QR được tạo theo đúng số tiền và mã đơn. Bản đồ án vẫn cho phép tự xác nhận để demo mà không cần chuyển tiền thật."
                : "Bạn sẽ nhập thông tin thẻ nội địa tại VNPay. Đây là môi trường sandbox, dùng để kiểm thử."}
            </p>
            {!configured && !bankDemo && (
              <p className="mt-3 text-sm text-amber-800">
                Thanh toán VNPay chưa sẵn sàng. Vui lòng liên hệ quán hoặc quay
                lại sau.
              </p>
            )}
          </section>
          {uncertain && (
            <InlineNotice>
              Yêu cầu trước chưa rõ kết quả. Nhấn kiểm tra lại để tìm đúng đơn,
              tránh tạo đơn trùng.
            </InlineNotice>
          )}
          {error && <InlineNotice type="error">{error}</InlineNotice>}
        </div>
        <aside className="rounded-[1.75rem] border border-[#e0d5cb] bg-white p-5 shadow-[0_14px_45px_rgba(65,42,31,0.07)] lg:sticky lg:top-24 lg:p-6">
          <h2 className="font-serif text-2xl text-[#302018]">Đơn của bạn</h2>
          <div className="mt-5 max-h-72 space-y-4 overflow-auto pr-1">
            {items.map((item) => (
              <div key={item.id} className="flex gap-3">
                {item.imageUrl && (
                  <img
                    src={item.imageUrl}
                    alt=""
                    className="size-14 shrink-0 rounded-xl object-cover"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex gap-2">
                    <p className="flex-1 text-sm font-semibold">
                      {item.productName}
                    </p>
                    <p className="text-sm font-semibold">
                      {formatCurrency(item.totalPrice)}
                    </p>
                  </div>
                  {item.isReward && (
                    <p className="mt-1 text-xs font-bold text-[#55735a]">
                      Sản phẩm đổi thưởng · {item.rewardPoints} điểm
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[#8a776d]">
                    {item.quantity} × Size {item.size}
                    {item.toppings.length > 0 &&
                      ` · ${item.toppings.map((t) => t.name).join(", ")}`}
                  </p>
                  <p className="mt-1 text-xs text-[#8a776d]">
                    Ngọt {drinkPercent[item.sweetnessLevel]}% · Đá{" "}
                    {drinkPercent[item.iceLevel]}%
                  </p>
                  {item.note && (
                    <p className="mt-1 text-xs italic">{item.note}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="my-5 h-px bg-[#ece4dc]" />
          <dl className="space-y-3 text-sm text-[#76645a]">
            <div className="flex justify-between">
              <dt>Tạm tính</dt>
              <dd>{formatCurrency(quote?.totalAmount ?? 0)}</dd>
            </div>
            <div className="flex justify-between text-[#59715a]">
              <dt>Giảm giá {quote?.promotionCode}</dt>
              <dd>-{formatCurrency(quote?.discountAmount ?? 0)}</dd>
            </div>
          </dl>
          <div className="my-5 h-px bg-[#ece4dc]" />
          <div className="flex items-end justify-between">
            <span className="font-semibold">Tổng cộng</span>
            <span className="text-xl font-bold">
              {formatCurrency(
                quote?.finalAmount ??
                  Number(pendingBody.current?.expectedAmount ?? 0),
              )}
            </span>
          </div>
          <Button
            fullWidth
            size="lg"
            className="mt-6"
            type="submit"
            disabled={
              busy ||
              (!uncertain &&
                (!quote ||
                  (!(method === "bank-demo"
                    ? bankDemo
                    : configured) &&
                    quote.finalAmount > 0)))
            }
          >
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" size={18} /> Đang xử
                lý...
              </>
            ) : (
              <>
                <LockKeyhole size={17} />{" "}
                {uncertain ? "Kiểm tra lại yêu cầu" : "Xác nhận & thanh toán"}
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-xs leading-5 text-[#958278]">
            Nguyên liệu được giữ trong 15 phút khi tạo đơn.
          </p>
        </aside>
      </form>
    </section>
  );
}
