import { useEffect, useRef, useState } from "react";
import { Button, ButtonLink, InlineNotice } from "./ui";
import { orderService, type Order } from "../services/orderService";
import { formatCurrency } from "../lib/utils";

type RefundableOrder = Pick<
  Order,
  "id" | "status" | "paidAt" | "refunds" | "finalAmount"
> & { payments: { status: string; paymentMethod: string }[] };
export default function RefundActions({
  order,
  onUpdated,
  admin = false,
}: {
  order: RefundableOrder;
  onUpdated: (order: Order) => void;
  admin?: boolean;
}) {
  const [now, setNow] = useState(Date.now);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [configuredMode, setConfiguredMode] = useState<"GATEWAY" | "SIMULATION" | null>(null);
  const update = useRef(onUpdated);
  const running = useRef(false);
  useEffect(() => {
    update.current = onUpdated;
  }, [onUpdated]);
  const deadline = order.paidAt ? Date.parse(order.paidAt) + 120000 : 0;
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const pending = order.status === "REFUND_PENDING";
  const refunded = order.status === "REFUNDED";
  const latest = order.refunds?.[0];
  const paymentMethod = order.payments.find(payment => payment.status === "SUCCESS")?.paymentMethod;
  const simulated = order.status === "PAID" ? configuredMode === "SIMULATION" && Number(order.finalAmount) > 0 : latest?.mode === "SIMULATION";
  useEffect(() => {
    if (order.status !== "PAID" || deadline <= Date.now()) return;
    let active = true;
    setConfiguredMode(null);
    void orderService.config().then(config => {
      const mode = paymentMethod === "VNPAY" || paymentMethod === "ZALOPAY" ? config.refundModes?.[paymentMethod] : undefined;
      if (active) setConfiguredMode(mode ?? config.refundMode ?? "GATEWAY");
    }).catch(() => {
      if (active) setError("Chưa tải được chế độ hoàn tiền. Vui lòng tải lại trang.");
    });
    return () => { active = false; };
  }, [order.id, order.status, deadline, paymentMethod]);
  useEffect(() => {
    if (order.status !== "PAID" || deadline <= Date.now()) return;
    const timer = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= deadline) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, order.status]);
  async function check() {
    if (running.current) return;
    running.current = true;
    try {
      update.current(await orderService.reconcileRefund(order.id));
      setError("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Chưa kiểm tra được hoàn tiền.",
      );
    } finally {
      running.current = false;
    }
  }
  useEffect(() => {
    if (!pending) return;
    let active = true;
    const poll = async () => {
      if (running.current) return;
      running.current = true;
      try {
        const result = await orderService.reconcileRefund(order.id);
        if (active) update.current(result);
      } catch {
        /* Keep the pending receipt; the next poll and server scheduler retry. */
      } finally {
        running.current = false;
      }
    };
    const timer = window.setInterval(() => {
      void poll();
    }, 6000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pending, order.id]);
  async function submit() {
    if (running.current || busy) return;
    running.current = true;
    setBusy(true);
    setError("");
    try {
      update.current(
        await orderService.refund(
          order.id,
          reason.trim() ||
            (admin
              ? "Quản trị viên yêu cầu hủy đơn"
              : "Khách hàng yêu cầu hủy đơn"),
        ),
      );
      setConfirm(false);
      window.dispatchEvent(new Event("cart-updated"));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Chưa gửi được yêu cầu hoàn tiền.",
      );
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  if (!["PAID", "REFUND_PENDING", "REFUNDED"].includes(order.status))
    return null;
  return (
    <div className="mt-5 space-y-3 border-t border-[#eee6df] pt-4">
      {error && <InlineNotice type="error">{error}</InlineNotice>}
      {simulated && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        Hoàn tiền mô phỏng
      </p>}
      {refunded ? (
        <>
          <p className="text-sm text-[#527155]">
            {Number(order.finalAmount) === 0 ? "Đã hủy đơn đổi thưởng 0đ." : simulated ? <>Đã hủy đơn và mô phỏng hoàn {formatCurrency(Number(latest?.amount ?? order.finalAmount))}.</> : <>Đã hoàn {formatCurrency(Number(latest?.amount ?? order.finalAmount))} về phương thức đã thanh toán.</>}
            {" "}Nguyên liệu và điểm đổi thưởng đã được hoàn lại; điểm tích lũy từ đơn được thu hồi.
          </p>
          <p className="text-sm text-[#756359]">
            Mời bạn chọn một đồ uống khác. Bạn vẫn có thể đặt lại món cũ nếu
            muốn.
          </p>
          {!admin && (
            <ButtonLink to="/" variant="secondary">
              Chọn đồ uống khác
            </ButtonLink>
          )}
        </>
      ) : pending ? (
        <>
          <p className="text-sm text-[#80654c]">
            {simulated ? "Đang xử lý hủy đơn và hoàn tiền mô phỏng " : "Đã nhận yêu cầu hủy trong thời hạn. Đang chờ xác nhận hoàn "}
            {formatCurrency(Number(latest?.amount ?? order.finalAmount))}. Kho
            và điểm sẽ cập nhật sau khi có kết quả xác nhận.
          </p>
          <Button variant="secondary" onClick={() => void check()}>
            Kiểm tra hoàn tiền
          </Button>
        </>
      ) : (
        <>
          {latest?.status === "FAILED" && (
            <InlineNotice type="error">
              Yêu cầu hoàn tiền không thành công. Tiền chưa được xác nhận hoàn
              trả; liên hệ quán nếu đã hết thời hạn hủy.
            </InlineNotice>
          )}
          {remaining > 0 ? (
            <>
              <p className="text-sm text-[#756359]">
                Còn {Math.floor(remaining / 60)}:
                {String(remaining % 60).padStart(2, "0")} để hủy và hoàn tiền.
              </p>
              {!confirm ? (
                <Button disabled={configuredMode === null} variant="secondary" onClick={() => setConfirm(true)}>
                  Hủy đơn và hoàn tiền
                </Button>
              ) : (
                <div className="space-y-3 rounded-2xl bg-[#f7f3ee] p-4">
                  <p className="text-sm">
                    {simulated ? "Xác nhận hủy và mô phỏng hoàn toàn bộ " : "Xác nhận hủy và hoàn toàn bộ "}
                    {formatCurrency(Number(order.finalAmount))}{simulated ? "?" : " qua cổng thanh toán?"} Điểm tích lũy từ đơn này sẽ được thu hồi.
                  </p>
                  <label className="block text-sm">
                    Lý do hủy (không bắt buộc)
                    <input
                      aria-label="Lý do hủy đơn đã thanh toán"
                      maxLength={100}
                      value={reason}
                      disabled={busy}
                      onChange={(event) => setReason(event.target.value)}
                      className="mt-2 w-full rounded-xl border border-[#dfd4c9] bg-white p-3"
                    />
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <Button
                      disabled={busy || remaining <= 0}
                      onClick={() => void submit()}
                    >
                      {busy
                        ? "Đang gửi yêu cầu..."
                        : "Xác nhận hủy và hoàn tiền"}
                    </Button>
                    <Button
                      disabled={busy}
                      variant="ghost"
                      onClick={() => setConfirm(false)}
                    >
                      Giữ đơn
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-[#8d7a70]">
              Đã quá 2 phút kể từ khi thanh toán thành công. Đơn không còn trong
              thời hạn hủy.
            </p>
          )}
        </>
      )}
      {latest?.reason && (pending || refunded || remaining > 0) && (
        <p className="text-xs text-[#8d7a70]">Lý do yêu cầu hủy: {latest.reason}</p>
      )}
    </div>
  );
}
