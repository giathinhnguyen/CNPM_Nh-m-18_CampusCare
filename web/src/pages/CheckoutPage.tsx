import { FormEvent, useRef, useState } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CreditCard,
  LoaderCircle,
  LockKeyhole,
  Smartphone,
} from "lucide-react"
import { Navigate, useNavigate } from "react-router-dom"
import {
  Button,
  ButtonLink,
  InlineNotice,
  PageTitle,
  TextInput,
  cx,
} from "../components/ui"
import { getPromotionDiscount } from "../data/promotions"
import { formatCurrency, getCartSubtotal } from "../lib/utils"
import { processCheckout } from "../services/orderService"
import { isRewardsMockMode } from "../services/rewardService"
import { useAppStore } from "../store/useAppStore"
import type { Order } from "../types"

export default function CheckoutPage() {
  const navigate = useNavigate()
  const {
    cart,
    promoCode,
    user,
    addOrder,
    checkoutSelection,
    completeCheckout,
    addToast,
    settleRewardOrder,
  } = useAppStore()
  const [method, setMethod] = useState<"wallet" | "card">("wallet")
  const [processing, setProcessing] = useState(false)
  const [error, setError] = useState("")
  const [failedOrder, setFailedOrder] = useState<Omit<Order, "status"> | null>(
    null,
  )
  const requestKey = useRef(crypto.randomUUID())
  const checkoutItems = cart.filter(
    (item) => checkoutSelection.includes(item.key) && !item.unavailable,
  )
  const subtotal = getCartSubtotal(checkoutItems)
  const discount = getPromotionDiscount(promoCode, subtotal)
  const total = Math.max(0, subtotal - discount)

  if (!user) return <Navigate to="/login?redirect=/checkout" replace />
  if (cart.length === 0 || checkoutItems.length === 0) {
    return <Navigate to="/cart" replace />
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (processing) return
    setProcessing(true)
    setError("")
    const form = new FormData(event.currentTarget)
    const cardNumber = String(form.get("cardNumber") ?? "")

    try {
      const result = await processCheckout({
        userId: user.id,
        items: checkoutItems,
        subtotal,
        discount,
        paymentMethod: method,
        idempotencyKey: requestKey.current,
        simulateFailure:
          method === "card" && cardNumber.replace(/\s/g, "").endsWith("0000"),
      })
      if (result.ok) {
        const order = result.order
        addOrder(order)
        if (isRewardsMockMode) {
          const redeemedPoints = order.items.reduce(
            (sum, item) => sum + (item.isReward ? (item.rewardPoints ?? 0) : 0),
            0,
          )
          if (redeemedPoints > 0) {
            settleRewardOrder(order.id, redeemedPoints)
          }
        }
        completeCheckout(checkoutSelection)
        addToast("Thanh toán thành công")
        navigate(`/orders/${order.id}/confirmation`)
      } else {
        setFailedOrder(result.attempt)
      }
    } catch {
      setError(
        "Chưa thể xác định kết quả thanh toán. Vui lòng kiểm tra lại trạng thái đơn hàng trước khi thử lại.",
      )
    } finally {
      setProcessing(false)
    }
  }

  const retryPayment = () => {
    requestKey.current = crypto.randomUUID()
    setFailedOrder(null)
    setError("")
  }

  const cancelOrder = () => {
    if (!failedOrder) return
    addOrder({ ...failedOrder, status: "CANCELLED" })
    setFailedOrder(null)
    addToast("Đã hủy đơn. Sản phẩm vẫn được giữ trong giỏ hàng.", "info")
    navigate("/cart")
  }

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
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl text-[#302018]">
                Thông tin khách hàng
              </h2>
              <span className="hidden text-xs text-[#8b796f] sm:block">
                * Bắt buộc
              </span>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold">
                Họ và tên *
                <TextInput name="name" defaultValue={user.name} required />
              </label>
              <label className="space-y-2 text-sm font-semibold">
                Số điện thoại *
                <TextInput
                  name="phone"
                  defaultValue={user.phone ?? ""}
                  placeholder="0901 234 567"
                  required
                />
              </label>
              <label className="space-y-2 text-sm font-semibold sm:col-span-2">
                Ghi chú cho quán
                <TextInput
                  name="note"
                  placeholder="Ví dụ: Mình sẽ đến nhận lúc 10 giờ..."
                />
              </label>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-[#e2d8ce] bg-white p-5 md:p-7">
            <h2 className="font-serif text-2xl text-[#302018]">
              Phương thức thanh toán
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {
                  id: "wallet" as const,
                  title: "Ví điện tử",
                  detail: "MoMo, ZaloPay hoặc VNPay",
                  icon: Smartphone,
                },
                {
                  id: "card" as const,
                  title: "Thẻ ngân hàng",
                  detail: "Visa, Mastercard, Napas",
                  icon: CreditCard,
                },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMethod(item.id)}
                    className={cx(
                      "relative flex min-h-24 items-center gap-4 rounded-2xl border p-4 text-left transition",
                      method === item.id
                        ? "border-[#5d765e] bg-[#edf3eb]"
                        : "border-[#ded4ca] hover:border-[#a58e7d]",
                    )}
                  >
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white text-[#51392e] shadow-sm">
                      <Icon size={21} />
                    </span>
                    <span>
                      <span className="block font-semibold">{item.title}</span>
                      <span className="mt-1 block text-xs text-[#837167]">
                        {item.detail}
                      </span>
                    </span>
                    {method === item.id && (
                      <span className="absolute right-3 top-3 grid size-5 place-items-center rounded-full bg-[#658066] text-white">
                        <Check size={12} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {method === "card" && (
              <div className="mt-5 grid gap-4 rounded-2xl bg-[#f7f3ee] p-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-semibold sm:col-span-2">
                  Số thẻ
                  <TextInput
                    name="cardNumber"
                    placeholder="4242 4242 4242 4242"
                    minLength={16}
                    required
                  />
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  Ngày hết hạn
                  <TextInput name="expiry" placeholder="MM/YY" required />
                </label>
                <label className="space-y-2 text-sm font-semibold">
                  CVV
                  <TextInput
                    name="cvv"
                    placeholder="123"
                    minLength={3}
                    required
                  />
                </label>
                <p className="text-xs leading-5 text-[#8a776c] sm:col-span-2">
                  Dùng số thẻ kết thúc bằng 0000 để mô phỏng thanh toán thất
                  bại.
                </p>
              </div>
            )}
          </section>
          {error && <InlineNotice type="error">{error}</InlineNotice>}
        </div>

        <aside className="rounded-[1.75rem] border border-[#e0d5cb] bg-white p-5 shadow-[0_14px_45px_rgba(65,42,31,0.07)] lg:sticky lg:top-24 lg:p-6">
          <h2 className="font-serif text-2xl text-[#302018]">Đơn của bạn</h2>
          <div className="mt-5 max-h-72 space-y-4 overflow-auto pr-1">
            {checkoutItems.map((item) => (
              <div key={item.key} className="flex gap-3">
                <img
                  src={item.image}
                  alt=""
                  className="size-14 shrink-0 rounded-xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex gap-2">
                    <p className="flex-1 truncate text-sm font-semibold">
                      {item.name}
                    </p>
                    <p className="text-sm font-semibold">
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </p>
                  </div>
                  {item.isReward && (
                    <p className="mt-1 text-xs font-bold text-[#55735a]">
                      Sản phẩm đổi thưởng ·{" "}
                      {item.rewardPoints?.toLocaleString("vi-VN")} điểm
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[#8a776d]">
                    {item.quantity} × Size {item.size.id}
                    {item.toppings.length > 0 &&
                      ` · ${item.toppings.map((item) => item.name).join(", ")}`}
                  </p>
                  <p className="mt-1 text-xs text-[#8a776d]">
                    Ngọt {item.sweetness?.value ?? 100}% · Đá{" "}
                    {item.ice?.value ?? 100}%
                  </p>
                  {item.note && (
                    <p className="mt-1 text-xs italic leading-5 text-[#6f5b50]">
                      Ghi chú: {item.note}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="my-5 h-px bg-[#ece4dc]" />
          <dl className="space-y-3 text-sm text-[#76645a]">
            <div className="flex justify-between">
              <dt>Tạm tính</dt>
              <dd>{formatCurrency(subtotal)}</dd>
            </div>
            <div className="flex justify-between text-[#59715a]">
              <dt>Giảm giá</dt>
              <dd>-{formatCurrency(discount)}</dd>
            </div>
          </dl>
          <div className="my-5 h-px bg-[#ece4dc]" />
          <div className="flex items-end justify-between">
            <span className="font-semibold">Tổng cộng</span>
            <span className="text-xl font-bold">{formatCurrency(total)}</span>
          </div>
          <Button
            fullWidth
            size="lg"
            className="mt-6"
            type="submit"
            disabled={processing}
          >
            {processing ? (
              <>
                <LoaderCircle className="animate-spin" size={18} /> Đang xử
                lý...
              </>
            ) : (
              <>
                <LockKeyhole size={17} /> Xác nhận & thanh toán
              </>
            )}
          </Button>
          <p className="mt-3 text-center text-xs leading-5 text-[#958278]">
            Yêu cầu được bảo vệ khỏi việc thanh toán lặp.
          </p>
        </aside>
      </form>

      {failedOrder && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#241710]/50 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="payment-failed-title"
        >
          <div className="w-full max-w-md rounded-[1.75rem] bg-white p-6 shadow-2xl sm:p-7">
            <span className="grid size-14 place-items-center rounded-full bg-[#f9e5e1] text-[#a13e33]">
              <AlertTriangle size={27} />
            </span>
            <h2
              id="payment-failed-title"
              className="mt-5 font-serif text-3xl text-[#302018]"
            >
              Thanh toán chưa thành công
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#756359]">
              Giao dịch chưa được xác nhận. Bạn có thể thử thanh toán lại hoặc
              hủy đơn. Các sản phẩm vẫn được giữ nguyên trong giỏ hàng.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Button fullWidth onClick={retryPayment}>
                Thanh toán lại
              </Button>
              <Button fullWidth variant="secondary" onClick={cancelOrder}>
                Hủy đơn hàng
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
