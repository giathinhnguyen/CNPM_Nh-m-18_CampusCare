import { useEffect, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { CheckCircle2, Clock3, RefreshCw, Landmark } from "lucide-react";
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
import BankQrPanel from "../components/BankQrPanel";
import DemoCardForm from "../components/DemoCardForm";

const labels = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
};
export default function OrdersPage() {
  const { id } = useParams();
  const location = useLocation();
  const { refreshUser } = useAuth();
  const returning = location.pathname === "/payments/return";
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [configured, setConfigured] = useState(false);
  const [bankDemo, setBankDemo] = useState(false);
  const [cardDemo, setCardDemo] = useState(false);
  const [method, setMethod] = useState("bank-demo");
  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const config = await orderService.config();
        if (active) setConfigured(config.configured);
        if (active) setBankDemo(config.bankTransferDemoEnabled);
        if (active) {
          setCardDemo(config.cardDemoEnabled);
          setMethod(
            new URLSearchParams(location.search).get("method") ===
              "card-demo" || !config.bankTransferDemoEnabled
              ? "card-demo"
              : "bank-demo",
          );
        }
        let data: Order[];
        if (returning) {
          const ref = new URLSearchParams(location.search).get("vnp_TxnRef");
          if (!ref)
            throw new Error(
              "Không có mã giao dịch. Vui lòng xem lịch sử đơn hàng.",
            );
          const order = await orderService.forPayment(ref);
          data = [order];
          try {
            data = [await orderService.reconcile(order.id)];
          } catch {
            if (active)
              setError(
                "Chưa nhận được kết quả cuối cùng từ VNPay. Bạn có thể kiểm tra lại trạng thái bên dưới.",
              );
          }
        } else
          data = id ? [await orderService.get(id)] : await orderService.list();
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
  }, [id, returning, location.search]);

  async function action(
    order: Order,
    kind: "check" | "pay" | "cancel" | "bank-demo" | "card-demo",
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (kind === "pay") {
        const result = await orderService.pay(
          order.id,
          crypto.randomUUID(),
          "wallet",
        );
        if (result.paymentUrl) {
          window.location.assign(result.paymentUrl);
          return;
        }
      }
      const updated =
        kind === "bank-demo"
          ? await orderService.confirmBankTransferDemo(order.id)
          : kind === "card-demo"
            ? await orderService.confirmCardDemo(order.id)
            : kind === "cancel"
              ? await orderService.cancel(order.id)
              : await orderService.reconcile(order.id);
      setOrders((current) =>
        current.map((o) => (o.id === updated.id ? updated : o)),
      );
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
  const detail = Boolean(id || returning);
  const confirmed = detail && orders[0]?.status === "PAID";
  return (
    <section
      className={`mx-auto px-4 py-8 sm:px-6 md:py-14 ${detail ? "max-w-3xl" : "max-w-5xl"}`}
    >
      {confirmed ? (
        <div className="mb-8 rounded-[2rem] bg-[#e4eee1] px-6 py-10 text-center">
          <CheckCircle2 size={48} className="mx-auto text-[#527155]" />
          <h1 className="mt-5 font-serif text-4xl text-[#302018]">
            Đặt hàng thành công
          </h1>
          <p className="mt-3 text-sm text-[#715f54]">
            BrewLite đã nhận đơn và sẽ bắt đầu chuẩn bị ngay.
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
            .filter((o) => filter === "ALL" || o.status === filter)
            .map((order) => {
              const pending = order.payments.some(
                (p) => p.status === "PENDING",
              );
              const review = order.payments.some((p) => p.needsReview);
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
                      {labels[order.status]}
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
                              : "VNPay"}
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
                  {order.status === "PENDING_PAYMENT" && (
                    <>
                      {detail &&
                        bankDemo &&
                        cardDemo &&
                        !pending &&
                        !review && (
                          <div className="mt-5 flex flex-wrap gap-2">
                            <Button
                              disabled={busy}
                              variant={
                                method === "bank-demo" ? "primary" : "secondary"
                              }
                              onClick={() => setMethod("bank-demo")}
                            >
                              QR chuyển khoản
                            </Button>
                            <Button
                              disabled={busy}
                              variant={
                                method === "card-demo" ? "primary" : "secondary"
                              }
                              onClick={() => setMethod("card-demo")}
                            >
                              Thẻ ngân hàng (demo)
                            </Button>
                          </div>
                        )}
                      {detail &&
                        cardDemo &&
                        method === "card-demo" &&
                        !pending &&
                        !review && (
                          <DemoCardForm
                            amount={Number(order.finalAmount)}
                            disabled={
                              busy ||
                              new Date(order.reservationExpiresAt) <= new Date()
                            }
                            onConfirm={() => void action(order, "card-demo")}
                          />
                        )}
                      {detail &&
                        bankDemo &&
                        method === "bank-demo" &&
                        !pending &&
                        !review && (
                          <section className="mt-5 rounded-2xl border border-[#cbdac8] bg-[#f0f5ed] p-5">
                            <h3 className="flex items-center gap-2 font-serif text-xl">
                              <Landmark size={22} /> Chuyển khoản ngân hàng —
                              demo
                            </h3>
                            <p className="mt-3 text-sm leading-6 text-[#62735e]">
                              Bản mô phỏng cho đồ án, không cần chuyển tiền
                              thật. Nhấn nút bên dưới để xác nhận thanh toán và
                              hoàn tất đơn.
                            </p>
                            <dl className="mt-4 space-y-2 text-sm">
                              <div className="flex flex-wrap justify-between gap-2">
                                <dt>Số tiền mô phỏng</dt>
                                <dd className="font-bold">
                                  {formatCurrency(Number(order.finalAmount))}
                                </dd>
                              </div>
                              <div className="flex flex-wrap justify-between gap-2">
                                <dt>Nội dung chuyển khoản</dt>
                                <dd className="break-all font-semibold">
                                  {order.orderCode}
                                </dd>
                              </div>
                            </dl>
                            {new Date(order.reservationExpiresAt) >
                              new Date() && <BankQrPanel orderId={order.id} />}
                            <Button
                              fullWidth
                              className="mt-5"
                              disabled={
                                busy ||
                                new Date(order.reservationExpiresAt) <=
                                  new Date()
                              }
                              onClick={() => void action(order, "bank-demo")}
                            >
                              <CheckCircle2 size={18} />
                              {busy
                                ? "Đang xác nhận..."
                                : "Xác nhận đã chuyển khoản"}
                            </Button>
                            <p className="mt-3 text-xs leading-5 text-[#62735e]">
                              Nút xác nhận mô phỏng việc nhận tiền; hệ thống sẽ
                              trừ nguyên liệu và cập nhật điểm thưởng.
                            </p>
                          </section>
                        )}
                      <p className="mt-4 flex items-center gap-2 text-xs text-[#8d7a70]">
                        <Clock3 size={14} /> Giữ nguyên liệu đến{" "}
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
                        {configured && (
                          <Button
                            disabled={
                              busy ||
                              review ||
                              !configured ||
                              new Date(order.reservationExpiresAt) <= new Date()
                            }
                            onClick={() => void action(order, "pay")}
                          >
                            {pending
                              ? "Tiếp tục tại VNPay"
                              : "Thanh toán qua VNPay"}
                          </Button>
                        )}
                        <Button
                          disabled={busy || pending || review}
                          variant="ghost"
                          onClick={() => setCancelTarget(order.id)}
                        >
                          Hủy đơn
                        </Button>
                      </div>
                      {pending && (
                        <p className="mt-3 text-xs leading-5 text-[#8d7a70]">
                          Chưa có kết quả cuối cùng. Hệ thống giữ nguyên liệu và
                          chưa cho hủy đơn để tránh sai lệch khi tiền đã được
                          trừ.
                        </p>
                      )}
                    </>
                  )}
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
