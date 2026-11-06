import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Button, ButtonLink, InlineNotice, LoadingState, PageTitle } from "../components/ui";

type Receipt = { orderId: string; status: string; paymentStatus: string; needsReview: boolean };
const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

export default function PaymentReturnPage() {
  const { search } = useLocation();
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setReceipt(null);
    void (async () => {
      try {
        const params = Object.fromEntries(new URLSearchParams(search));
        if (!params.vnp_TxnRef || !params.vnp_SecureHash)
          throw new Error("Thiếu kết quả có chữ ký VNPay. Vui lòng mở lại đường dẫn VNPay trả về hoặc xem lịch sử đơn hàng.");
        // No JWT: the backend authenticates the signed receipt, not the browser session.
        const response = await fetch(`${API}/payments/vnpay/result`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Chưa xác nhận được kết quả thanh toán");
        if (active) {
          setReceipt(data);
          window.dispatchEvent(new Event("cart-updated"));
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể kết nối máy chủ");
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [search, attempt]);

  if (loading) return <LoadingState label="Đang xác minh kết quả VNPay..." />;
  const paid = receipt?.status === "PAID" && receipt.paymentStatus === "SUCCESS" && !receipt.needsReview;
  const failed = receipt?.status === "PAYMENT_FAILED" && receipt.paymentStatus === "FAILED" && !receipt.needsReview;
  if (paid || failed) return <Navigate to={`/orders/${receipt.orderId}/confirmation`} replace />;
  return <section className="mx-auto max-w-3xl px-4 py-12">
    <PageTitle eyebrow="VNPay" title={paid ? "Thanh toán thành công" : "Kết quả thanh toán"}
      description={paid ? "BrewLite đã xác nhận thanh toán của đơn hàng." : "Kết quả được xác minh tại máy chủ BrewLite."} />
    {error && <InlineNotice type="error">{error}</InlineNotice>}
    {receipt?.needsReview && <InlineNotice>Giao dịch thành công nhưng đơn cần đối soát. Vui lòng liên hệ quán, không thanh toán lại.</InlineNotice>}
    {receipt && !paid && !receipt.needsReview && <InlineNotice>
      {receipt.paymentStatus === "FAILED" ? "Giao dịch đã hủy hoặc không thành công. Mở đơn hàng để chọn lại phương thức nếu đơn còn hạn."
        : "Chưa có kết quả cuối cùng. Không thanh toán lại khi giao dịch còn chờ xác nhận."}
    </InlineNotice>}
    <p className="mt-5 text-sm text-[#756359]">Bạn chỉ cần đăng nhập khi xem chi tiết đơn hàng. Phiên đăng nhập hết hạn không ngăn hệ thống nhận kết quả thanh toán có chữ ký hợp lệ.</p>
    <div className="mt-6 flex flex-wrap gap-3">
      {receipt && <ButtonLink to={`/orders/${receipt.orderId}`}>Xem chi tiết đơn hàng</ButtonLink>}
      {!paid && <Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Kiểm tra lại kết quả</Button>}
      <ButtonLink to="/orders" variant="ghost">Lịch sử đơn hàng</ButtonLink>
    </div>
  </section>;
}
