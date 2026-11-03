import type { OrderStatus } from "../types"
import { statusLabels } from "../lib/utils"
import { cx } from "./ui"

export default function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={cx(
        "inline-flex rounded-full px-3 py-1.5 text-xs font-bold",
        status === "PAID" && "bg-[#e5eee3] text-[#31583b]",
        status === "CANCELLED" && "bg-[#f9e1de] text-[#8c382e]",
      )}
    >
      {statusLabels[status]}
    </span>
  )
}
