import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";
import {
  Button,
  ButtonLink,
  EmptyState,
  InlineNotice,
  LoadingState,
  PageTitle,
} from "../components/ui";
import {
  drinkPercent,
  orderService,
  type Order,
} from "../services/orderService";
import { formatCurrency } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import ZalopayQrPanel from "../components/ZalopayQrPanel";
import RefundActions from "../components/RefundActions";

const labels = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PAYMENT_FAILED: "Thanh toán thất bại",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
  REFUND_PENDING: "Đang hoàn tiền",
  REFUNDED: "Đã hủy · Đã hoàn tiền",
};
function paymentWindowExpired(order: Order, now: number) {
  return order.status === "EXPIRED" ||
    (["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(order.status) && Date.parse(order.reservationExpiresAt) <= now);
}
function visibleStatus(order: Order, now: number) {
  return paymentWindowExpired(order, now) ? "EXPIRED" : order.status;
}
export default function OrdersPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const latestOrders = useRef<Order[]>([]);
  const [now, setNow] = useState(Date.now);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>(location.state?.paymentError ?? "");
  const [filter, setFilter] = useState("ALL");
  const [configured, setConfigured] = useState(false);
  const [zalopayConfigured, setZalopayConfigured] = useState(false);
  const [method, setMethod] = useState("zalopay");
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const config = await orderService.config();
        if (active) setConfigured(config.configured);
        if (active) setZalopayConfigured(config.zalopayConfigured);
        if (active) {
          const requested = new URLSearchParams(location.search).get("method");
          setMethod(requested === "card" && config.configured ? "card"
            : config.zalopayConfigured ? "zalopay" : "card");
        }
        const data = id ? [await orderService.get(id)] : await orderService.list();
        if (active) setOrders(data);
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Không thể tải đơn hàng",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id, location.search]);

  async function action(
    order: Order,
    kind: "check" | "pay" | "cancel" | "retry",
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (kind === "pay") {
        const pending = order.payments.find(p => p.status === "PENDING");
        const channel = pending ? pending.paymentMethod === "ZALOPAY" ? "zalopay" : "card" : method;
        const result = await orderService.pay(
          order.id,
          crypto.randomUUID(),
          channel,
        );
        if (channel === "zalopay") {
          const updated = await orderService.get(order.id);
          setOrders(current => current.map(o => o.id === updated.id ? updated : o));
          return;
        }
        if (result.paymentUrl) {
          window.location.assign(result.paymentUrl);
          return;
        }
      }
      const updated =
        kind === "retry"
              ? await orderService.retry(order.id)
            : kind === "cancel"
              ? await orderService.cancel(order.id)
              : await orderService.reconcile(order.id);
      setOrders((current) =>
        current.map((o) => (o.id === updated.id ? updated : o)),
      );
      if (id && ["PAID", "PAYMENT_FAILED"].includes(updated.status))
        navigate(`/orders/${updated.id}/confirmation`, { replace: true });
      void refreshUser().catch(() => {});
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Chưa xác định được kết quả",
      );
    } finally {
      setBusy(false);
      setCancelTarget(null);
    }
  }
  const watchKey = orders.filter(order => ["PENDING_PAYMENT", "PAYMENT_FAILED", "REFUND_PENDING"].includes(order.status) ||
    (order.status === "PAID" && order.paidAt && Date.parse(order.paidAt) + 135000 > Date.now())).map(order => order.id).join(",");
  const overdueKey = orders.filter(order => ["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(order.status) && paymentWindowExpired(order, now)).map(order => order.id).join(",");
  useEffect(() => { latestOrders.current = orders; }, [orders]);
  useEffect(() => {
    if (!watchKey) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [watchKey]);
  useEffect(() => {
    if (!watchKey) return;
    let active = true;
    let checking = false;
    const refresh = async () => {
      if (checking) return;
      checking = true;
      try {
        const previous = latestOrders.current;
        const targets = previous.filter(order => ["PENDING_PAYMENT", "PAYMENT_FAILED"].includes(order.status) &&
          !order.payments.some(payment => payment.needsReview) &&
          (paymentWindowExpired(order, Date.now()) || Boolean(id && order.payments.some(payment => payment.paymentMethod === "ZALOPAY" && payment.status === "PENDING")))).slice(0, 4);
        await Promise.allSettled(targets.map(async order => {
          const updated = await orderService.reconcile(order.id);
          if (active) {
            setOrders(current => current.map(item => item.id === updated.id ? updated : item));
            if (updated.status !== order.status) {
              window.dispatchEvent(new Event("cart-updated"));
              void refreshUser().catch(() => {});
            }
          }
        }));
        const data = id ? [await orderService.get(id)] : await orderService.list();
        if (active) {
          setOrders(data);
          if (data.some(order => previous.some(item => item.id === order.id && item.status !== order.status))) {
            window.dispatchEvent(new Event("cart-updated"));
            void refreshUser().catch(() => {});
          }
          if (id && ["PAID", "PAYMENT_FAILED"].includes(data[0]?.status))
            navigate(`/orders/${id}/confirmation`, { replace: true });
        }
      } catch {
        // Preserve the visible order on a temporary connection failure; the next poll retries.
      } finally { checking = false; }
    };
    void refresh();
    const timer = window.setInterval(() => { void refresh(); }, 6000);
    return () => { active = false; window.clearInterval(timer); };
  }, [id, watchKey, overdueKey, navigate, refreshUser]);
  const detail = Boolean(id);
  const confirmed = detail && orders[0]?.status === "PAID";
  const expired = detail && orders[0] && paymentWindowExpired(orders[0], now);
  const failed = detail && !expired && orders[0]?.status === "PAYMENT_FAILED";
  return (
    <section
      className={`mx-auto px-4 py-8 sm:px-6 md:py-14 ${detail ? "max-w-3xl" : "max-w-5xl"}`}
    >
      {detail && ["REFUND_PENDING", "REFUNDED"].includes(orders[0]?.status) ? (
        <PageTitle eyebrow="Đơn hàng của bạn" title={orders[0].status === "REFUNDED" ? "Đơn đã hủy và hoàn tiền" : "Đang xử lý hoàn tiền"}
          description={orders[0].status === "REFUNDED" ? "Mời bạn quay lại menu chọn đồ uống yêu thích." : "Yêu cầu hủy đã được tiếp nhận. Kết quả sẽ cập nhật khi cổng xác nhận."} />
      ) : confirmed ? (
        <div className="mb-8 rounded-[2rem] bg-[#e4eee1] px-6 py-10 text-center">
          <CheckCircle2 size={48} className="mx-auto text-[#527155]" />
          <h1 className="mt-5 font-serif text-4xl text-[#302018]">
            Đặt hàng thành công
          </h1>
          <p className="mt-3 text-sm text-[#715f54]">
            BrewLite đã nhận đơn và sẽ bắt đầu chuẩn bị ngay.
          </p>
        </div>
      ) : expired ? (
        <div className="mb-8 rounded-[2rem] bg-amber-50 px-6 py-10 text-center">
          <Clock3 size={48} className="mx-auto text-amber-700" />
          <h1 className="mt-5 font-serif text-4xl text-[#302018]">Đơn hàng đã hết hạn</h1>
          <p className="mt-3 text-sm text-[#715f54]">
            {orders[0].payments.some(payment => payment.status === "PENDING" || payment.needsReview)
              ? "Đang xác nhận kết quả thanh toán. Vui lòng chờ trước khi đặt lại."
              : "Thời gian thanh toán đã kết thúc. Bạn có thể quay lại giỏ hàng để đặt đơn mới."}
          </p>
        </div>
      ) : failed ? (
        <div role="alert" className="mb-8 rounded-[2rem] bg-red-50 px-6 py-10 text-center">
          <XCircle size={48} className="mx-auto text-red-600" />
          <h1 className="mt-5 font-serif text-4xl text-[#302018]">
            Thanh toán thất bại
          </h1>
          <p className="mt-3 text-sm text-[#715f54]">
            Giao dịch đã hủy hoặc không thành công. Bạn có thể thử thanh toán lại nếu đơn còn trong thời gian thanh toán.
          </p>
        </div>
      ) : (
        <PageTitle
          eyebrow="Tài khoản của bạn"
          title={detail ? "Thông tin đơn hàng" : "Lịch sử đơn hàng"}
          description="Theo dõi thanh toán và xem lại các món bạn đã đặt."
        />
      )}
      {error && (
        <div className="mt-5">
          <InlineNotice type="error">{error}</InlineNotice>
        </div>
      )}
      {!detail && (
        <div className="mt-7 flex gap-2 overflow-auto pb-2">
          {[["ALL", "Tất cả"], ...Object.entries(labels)].map(
            ([value, label]) => (
              <Button
                key={value}
                variant={filter === value ? "primary" : "secondary"}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ),
          )}
        </div>
      )}
      {loading ? (
        <LoadingState label="Đang tải đơn hàng..." />
      ) : (
        <div className="mt-7 space-y-5">
          {orders
            .filter((o) => filter === "ALL" || visibleStatus(o, now) === filter)
            .map((order) => {
              const windowExpired = paymentWindowExpired(order, now);
              const pending = order.payments.some(
                (p) => p.status === "PENDING",
              );
              const pendingMethod = order.payments.find(p => p.status === "PENDING")?.paymentMethod;
              const gatewayName = pendingMethod === "ZALOPAY" || (!pending && method === "zalopay") ? "ZaloPay" : "VNPay";
              const gatewayConfigured = gatewayName === "ZaloPay" ? zalopayConfigured : configured;
              const review = order.payments.some((p) => p.needsReview);
              const cancellationBlocked = review || order.payments.some(payment => payment.status === "PENDING" && payment.paymentMethod !== "ZALOPAY");
              const simulated = order.payments.some(
                (p) =>
                  p.status === "SUCCESS" &&
                  p.transactionId?.startsWith("DEMO-"),
              );
              return (
                <article
                  key={order.id}
                  className="rounded-[1.75rem] border border-[#e1d7cd] bg-white p-5 shadow-sm sm:p-7"
                >
                  <div className="flex flex-wrap justify-between gap-3 border-b border-[#eee6df] pb-4">
                    <div>
                      <p className="text-xs text-[#907e73]">Mã đơn hàng</p>
                      <h2 className="mt-1 break-all font-serif text-2xl text-[#302018]">
                        #{order.orderCode}
                      </h2>
                      <p className="mt-1 text-xs text-[#8d7a70]">
                        {new Date(order.createdAt).toLocaleString("vi-VN")}
                      </p>
                    </div>
                    <span
                      className={`h-fit rounded-full px-3 py-2 text-xs font-semibold ${order.status === "PAID" ? "bg-[#e4eee1] text-[#527155]" : "bg-[#f5ede2] text-[#80654c]"}`}
                    >
                      {labels[visibleStatus(order, now)]}
                    </span>
                  </div>
                  {simulated && (
                    <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
                      Thanh toán mô phỏng cho đồ án · Khách hàng tự xác nhận,
                      không có giao dịch ngân hàng được kiểm chứng.
                    </p>
                  )}
                  <div className="space-y-4 py-5">
                    {order.items.map((item) => (
                      <div key={item.id} className="flex gap-3">
                        {item.product.imageUrl && (
                          <img
                            src={item.product.imageUrl}
                            alt=""
                            className="size-14 rounded-xl object-cover"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold">
                            {item.quantity} × {item.productName}
                          </p>
                          <p className="mt-1 text-xs text-[#87756b]">
                            Size {item.size} · Ngọt{" "}
                            {drinkPercent[item.sweetnessLevel]}% · Đá{" "}
                            {drinkPercent[item.iceLevel]}%
                          </p>
                          {item.toppings.length > 0 && (
                            <p className="mt-1 text-xs text-[#87756b]">
                              {item.toppings
                                .map((t) => t.toppingName)
                                .join(", ")}
                            </p>
                          )}
                          {item.rewardPoints && (
                            <p className="mt-1 text-xs text-[#55735a]">
                              Đổi thưởng · {item.rewardPoints} điểm
                            </p>
                          )}
                          {item.note && (
                            <p className="mt-1 text-xs italic">{item.note}</p>
                          )}
                        </div>
                        <span className="text-sm font-bold">
                          {formatCurrency(Number(item.totalPrice))}
                        </span>
                      </div>
                    ))}
                  </div>
                  {detail && (
                    <div className="mb-5 rounded-2xl bg-[#f7f3ee] p-4 text-sm leading-7">
                      <p>
                        {order.customerName} · {order.customerPhone}
                      </p>
                      {order.note && <p>Ghi chú: {order.note}</p>}
                      <p>
                        Tạm tính: {formatCurrency(Number(order.totalAmount))}
                      </p>
                      <p>
                        Giảm giá {order.promotionCode}: −
                        {formatCurrency(Number(order.discountAmount))}
                      </p>
                      <p>
                        Điểm nhận:{" "}
                        {order.loyaltyTxs
                          .filter((t) => t.type === "EARN")
                          .reduce((sum, t) => sum + t.pointsChange, 0)}
                      </p>
                      {order.payments.length > 0 && (
                        <p>
                          {order.payments[0].paymentMethod === "BANK_TRANSFER"
                            ? "Chuyển khoản ngân hàng"
                            : order.payments[0].paymentMethod === "CARD_DEMO"
                              ? "Thẻ ngân hàng (demo)"
                              : order.payments[0].paymentMethod === "ZALOPAY" ? "ZaloPay (sandbox)" : "VNPay"}
                          :{" "}
                          {order.payments[0].status === "SUCCESS"
                            ? "Thành công"
                            : order.payments[0].status === "FAILED"
                              ? "Không thành công"
                              : "Chờ xác nhận"}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t border-[#eee6df] pt-4">
                    <span className="text-sm text-[#756359]">
                      {order.status === "PAID" ? "Đã thanh toán" : "Tổng cộng"}
                    </span>
                    <strong className="text-xl">
                      {formatCurrency(Number(order.finalAmount))}
                    </strong>
                  </div>
                  {review && (
                    <div className="mt-4">
                      <InlineNotice>
                        Giao dịch đã thu tiền nhưng đơn cần đối soát. Vui lòng
                        liên hệ quán với mã đơn trên để được xử lý hoặc hoàn
                        tiền.
                      </InlineNotice>
                    </div>
                  )}
                  {order.status === "PAYMENT_FAILED" && !windowExpired && (
                    <div className="mt-5 space-y-4">
                      <div className="flex flex-wrap gap-3">
                        <Button disabled={busy || pending || review || new Date(order.reservationExpiresAt) <= new Date()}
                          onClick={() => void action(order, "retry")}>Thử thanh toán lại</Button>
                        <Button variant="ghost" disabled={busy || cancellationBlocked}
                          onClick={() => setCancelTarget(order.id)}>Hủy đơn</Button>
                      </div>
                    </div>
                  )}
                  {order.status === "PENDING_PAYMENT" && (
                    <>
                      {detail &&
                        !windowExpired &&
                        !pending &&
                        !review && (
                          <div className="mt-5 flex flex-wrap gap-2">
                            <p className="w-full text-sm font-semibold">Chọn phương thức thanh toán</p>
                            {configured && (<>
                              <Button disabled={busy} variant={method === "card" ? "primary" : "secondary"} onClick={() => setMethod("card")}>
                                Thẻ nội địa qua VNPay
                              </Button>
                            </>)}
                            {zalopayConfigured && (
                            <Button
                              disabled={busy}
                              variant={
                                method === "zalopay" ? "primary" : "secondary"
                              }
                              onClick={() => setMethod("zalopay")}
                            >
                              Thanh toán bằng ZaloPay
                            </Button>)}
                          </div>
                        )}
                      {detail && pendingMethod === "ZALOPAY" && !review && !windowExpired && <ZalopayQrPanel key={order.id} orderId={order.id} />}
                      <p className="mt-4 flex items-center gap-2 text-xs text-[#8d7a70]">
                        <Clock3 size={14} /> {windowExpired ? "Đã hết thời gian thanh toán lúc " : "Thanh toán trước "}
                        {new Date(
                          order.reservationExpiresAt,
                        ).toLocaleTimeString("vi-VN")}
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <Button
                          disabled={busy}
                          variant="secondary"
                          onClick={() => void action(order, "check")}
                        >
                          <RefreshCw size={15} /> Kiểm tra trạng thái
                        </Button>
                        {!windowExpired && gatewayConfigured && !(pending && pendingMethod === "ZALOPAY") && (
                          <Button
                            disabled={
                              busy ||
                              review ||
                              !gatewayConfigured ||
                              new Date(order.reservationExpiresAt) <= new Date()
                            }
                            onClick={() => void action(order, "pay")}
                          >
                            {pending ? `Tiếp tục tại ${gatewayName}` : `Thanh toán qua ${gatewayName}`}
                          </Button>
                        )}
                        <Button
                          disabled={busy || cancellationBlocked}
                          variant="ghost"
                          onClick={() => setCancelTarget(order.id)}
                        >
                          Hủy đơn
                        </Button>
                      </div>
                      {pending && (
                        <p className="mt-3 text-xs leading-5 text-[#8d7a70]">
                          {windowExpired ? "Đang cập nhật kết quả thanh toán của đơn đã hết hạn."
                            : cancellationBlocked ? "Thanh toán đang chờ xác nhận. Vui lòng kiểm tra trạng thái trước khi hủy."
                              : "Đơn sẽ được cập nhật sau khi thanh toán. Bạn vẫn có thể hủy nếu chưa thanh toán."}
                        </p>
                      )}
                    </>
                  )}
                  <RefundActions order={order} onUpdated={updated => {
                    setOrders(current => current.map(item => item.id === updated.id ? updated : item));
                    void refreshUser().catch(() => {});
                  }} />
                  {!detail && (
                    <div className="mt-4">
                      <ButtonLink to={`/orders/${order.id}`} variant="ghost">
                        Xem chi tiết
                      </ButtonLink>
                    </div>
                  )}
                </article>
              );
            })}
          {!orders.length && !error && (
            <EmptyState
              title="Chưa có đơn hàng"
              description="Chọn món yêu thích để bắt đầu đơn đầu tiên."
              action={<ButtonLink to="/">Khám phá menu</ButtonLink>}
            />
          )}
        </div>
      )}
      <div className="mt-7 flex gap-3">
        <ButtonLink to="/" variant="secondary">
          Về trang chủ
        </ButtonLink>
        {detail && <ButtonLink to="/orders">Lịch sử đơn hàng</ButtonLink>}
      </div>
      {cancelTarget && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#241710]/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
        >
          <div className="w-full max-w-md rounded-[1.75rem] bg-white p-7">
            <h2 id="cancel-title" className="font-serif text-2xl">
              Hủy đơn hàng?
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#756359]">
              Món mua thường được đưa lại giỏ. Điểm giữ cho quà sẽ được giải
              phóng; bạn có thể đổi quà lại sau.
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                disabled={busy}
                onClick={() =>
                  void action(
                    orders.find((o) => o.id === cancelTarget)!,
                    "cancel",
                  )
                }
              >
                Xác nhận hủy
              </Button>
              <Button
                disabled={busy}
                variant="secondary"
                onClick={() => setCancelTarget(null)}
              >
                Giữ đơn
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
