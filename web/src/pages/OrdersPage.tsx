import { useEffect, useMemo, useState } from "react"
import { ChevronDown, PackageOpen } from "lucide-react"
import { Navigate } from "react-router-dom"
import OrderStatusBadge from "../components/OrderStatusBadge"
import { Button, ButtonLink, EmptyState, LoadingState, PageTitle, cx } from "../components/ui"
import { formatCurrency, formatDate } from "../lib/utils"
import { useAppStore } from "../store/useAppStore"
import type { OrderStatus } from "../types"

const filters: Array<{ label: string; value: "ALL" | OrderStatus }> = [
  { label: "Tất cả", value: "ALL" },
  { label: "Đã thanh toán", value: "PAID" },
  { label: "Đã hủy", value: "CANCELLED" },
]

export default function OrdersPage() {
  const { orders, user } = useAppStore()
  const [filter, setFilter] = useState<"ALL" | OrderStatus>("ALL")
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(3)

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 500)
    return () => window.clearTimeout(timer)
  }, [])

  const filtered = useMemo(
    () =>
      orders
        .filter((order) => order.userId === user?.id)
        .filter((order) => filter === "ALL" || order.status === filter)
        .sort(
          (first, second) =>
            new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime(),
        ),
    [filter, orders, user?.id],
  )

  if (!user) return <Navigate to="/login?redirect=/orders" replace />

  return (
    <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6 md:py-14">
      <PageTitle
        eyebrow="Tài khoản của bạn"
        title="Lịch sử đơn hàng"
        description="Theo dõi những món đang được chuẩn bị và xem lại các lần thưởng thức trước."
      />
      <div className="mt-7 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">
        {filters.map((item) => (
          <button
            key={item.value}
            onClick={() => {
              setFilter(item.value)
              setVisible(3)
            }}
            className={cx(
              "min-h-10 shrink-0 rounded-full px-5 text-sm font-semibold transition",
              filter === item.value
                ? "bg-[#3b241c] text-white"
                : "border border-[#ddd2c8] bg-white text-[#6c584d]",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState label="Đang tải đơn hàng của bạn..." />
      ) : filtered.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            title="Chưa có đơn hàng"
            description="Không có đơn hàng nào trong trạng thái này. Một ly ngon mới chỉ cách bạn vài chạm."
            action={<ButtonLink to="/#menu">Khám phá menu</ButtonLink>}
          />
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {filtered.slice(0, visible).map((order) => (
            <article
              key={order.id}
              className="rounded-[1.75rem] border border-[#e1d7cd] bg-white p-5 shadow-[0_10px_35px_rgba(65,42,31,0.05)] md:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eee6df] pb-4">
                <div>
                  <p className="text-xs text-[#907e73]">Mã đơn hàng</p>
                  <h2 className="mt-1 font-serif text-2xl text-[#302018]">
                    #{order.id}
                  </h2>
                  <p className="mt-1 text-xs text-[#8d7a70]">{formatDate(order.createdAt)}</p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>
              <div className="py-4">
                {order.items.slice(0, 2).map((item) => (
                  <div key={item.key} className="py-1.5">
                    <div className="flex items-center gap-3">
                      <img
                        src={item.image}
                        alt=""
                        className="size-11 rounded-xl object-cover"
                      />
                      <p className="min-w-0 flex-1 truncate text-sm font-medium">
                        {item.quantity} × {item.name}
                      </p>
                      <p className="text-right text-xs leading-5 text-[#79665b]">
                        Size {item.size.id}
                        <span className="block">
                          Ngọt {item.sweetness?.value ?? 100}% · Đá{" "}
                          {item.ice?.value ?? 100}%
                        </span>
                      </p>
                    </div>
                    {item.note && (
                      <p className="ml-14 mt-1 text-xs italic text-[#7b675c]">
                        Ghi chú: {item.note}
                      </p>
                    )}
                  </div>
                ))}
                {order.items.length > 2 && (
                  <p className="mt-2 text-xs text-[#8c796f]">
                    + {order.items.length - 2} sản phẩm khác
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between gap-4 border-t border-[#eee6df] pt-4">
                <div>
                  <p className="text-xs text-[#907e73]">Tổng thanh toán</p>
                  <p className="mt-0.5 font-bold">{formatCurrency(order.total)}</p>
                </div>
                <ButtonLink
                  to={`/orders/${order.id}/confirmation`}
                  variant="secondary"
                >
                  Xem chi tiết
                </ButtonLink>
              </div>
            </article>
          ))}
          {visible < filtered.length && (
            <div className="pt-3 text-center">
              <Button variant="secondary" onClick={() => setVisible((value) => value + 3)}>
                Tải thêm <ChevronDown size={17} />
              </Button>
            </div>
          )}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="mt-10 flex items-start gap-3 rounded-2xl bg-[#eee8e1] p-4 text-sm text-[#705e53]">
          <PackageOpen className="mt-0.5 shrink-0" size={18} />
          Trạng thái đơn hàng do hệ thống cập nhật. Bạn không cần thao tác trên nhãn trạng thái.
        </div>
      )}
    </section>
  )
}
