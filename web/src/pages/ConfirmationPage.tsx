import { ArrowRight, CheckCircle2, Home } from "lucide-react"
import { Navigate, useParams } from "react-router-dom"
import OrderStatusBadge from "../components/OrderStatusBadge"
import { ButtonLink, ErrorState } from "../components/ui"
import { formatCurrency } from "../lib/utils"
import { useAppStore } from "../store/useAppStore"

export default function ConfirmationPage() {
  const { id } = useParams()
  const { orders, user } = useAppStore()

  if (!user) return <Navigate to="/login" replace />
  const order = orders.find((item) => item.id === id && item.userId === user.id)

  if (!order) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-16">
        <ErrorState
          title="Không tìm thấy đơn hàng"
          description="Mã đơn hàng không tồn tại hoặc không thuộc tài khoản hiện tại."
          action={<ButtonLink to="/orders">Xem lịch sử đơn hàng</ButtonLink>}
        />
      </section>
    )
  }

  if (order.status !== "PAID") {
    return (
      <section className="mx-auto max-w-7xl px-4 py-16">
        <ErrorState
          title="Đơn hàng chưa được thanh toán"
          description="Trang xác nhận chỉ hiển thị cho giao dịch đã thanh toán thành công."
          action={<ButtonLink to="/orders">Xem lịch sử đơn hàng</ButtonLink>}
        />
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 sm:px-6 md:py-18">
      <div className="overflow-hidden rounded-[2rem] border border-[#e1d7cd] bg-white shadow-[0_18px_60px_rgba(65,42,31,0.09)]">
        <div className="bg-[#e4eee1] px-6 py-10 text-center md:px-10">
          <span className="mx-auto grid size-18 place-items-center rounded-full bg-white text-[#527155] shadow-md">
            <CheckCircle2 size={36} />
          </span>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-[#735f53]">
            Đơn hàng #{order.id}
          </p>
          <h1 className="mt-2 font-serif text-4xl text-[#302018]">
            Đặt hàng thành công
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#715f54]">
            Cảm ơn bạn. BrewLite đã nhận đơn và sẽ bắt đầu chuẩn bị ngay.
          </p>
          <div className="mt-5">
            <OrderStatusBadge status={order.status} />
          </div>
        </div>

        <div className="p-5 sm:p-8">
          <div className="space-y-4">
            {order.items.map((item) => (
              <div key={item.key} className="flex items-center gap-4">
                <img
                  src={item.image}
                  alt={item.name}
                  className="size-16 rounded-2xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{item.name}</p>
                  {item.isReward && (
                    <p className="mt-1 text-xs font-bold text-[#55735a]">
                      Sản phẩm đổi thưởng · {item.rewardPoints?.toLocaleString("vi-VN")} điểm
                    </p>
                  )}
                  <p className="mt-1 text-xs text-[#87756b]">
                    {item.quantity} × Size {item.size.id}
                    {item.toppings.length > 0 &&
                      ` · ${item.toppings.map((topping) => topping.name).join(", ")}`}
                  </p>
                  <p className="mt-1 text-xs text-[#87756b]">
                    Ngọt {item.sweetness?.value ?? 100}% · Đá{" "}
                    {item.ice?.value ?? 100}%
                  </p>
                  {item.note && (
                    <p className="mt-1 text-xs italic leading-5 text-[#6f5b50]">
                      Ghi chú: {item.note}
                    </p>
                  )}
                </div>
                <p className="text-sm font-bold">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </p>
              </div>
            ))}
          </div>
          <div className="my-6 h-px bg-[#ece4dc]" />
          <div className="flex items-end justify-between">
            <span className="text-sm text-[#756359]">
              Đã thanh toán
            </span>
            <span className="text-2xl font-bold text-[#39271f]">
              {formatCurrency(order.total)}
            </span>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <ButtonLink to="/orders" className="w-full">
              Theo dõi đơn hàng <ArrowRight size={17} />
            </ButtonLink>
            <ButtonLink
              to="/"
              variant="secondary"
              className="w-full"
            >
              <Home size={17} /> Về trang chủ
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  )
}
