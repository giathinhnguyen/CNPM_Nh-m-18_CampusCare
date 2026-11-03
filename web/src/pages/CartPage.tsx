import { useState } from "react"
import { ArrowLeft, Check, Minus, Plus, Tag, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import {
  Button,
  ButtonLink,
  EmptyState,
  InlineNotice,
  PageTitle,
  TextArea,
  TextInput,
} from "../components/ui"
import { getPromotion, getPromotionDiscount } from "../data/promotions"
import { formatCurrency, getCartSubtotal } from "../lib/utils"
import { useAppStore } from "../store/useAppStore"

export default function CartPage() {
  const navigate = useNavigate()
  const {
    cart,
    discount,
    promoCode,
    updateQuantity,
    updateItemNote,
    removeFromCart,
    applyPromo,
    addToast,
    setCheckoutSelection,
  } = useAppStore()
  const [selectedKeys, setSelectedKeys] = useState<string[]>(() =>
    cart.filter((item) => !item.unavailable).map((item) => item.key),
  )
  const [code, setCode] = useState(promoCode ?? "")
  const [promoError, setPromoError] = useState("")
  const [pendingRemoval, setPendingRemoval] = useState<string | null>(null)
  const selectedItems = cart.filter((item) => selectedKeys.includes(item.key))
  const subtotal = getCartSubtotal(selectedItems)
  const activeDiscount = promoCode
    ? getPromotionDiscount(promoCode, subtotal)
    : discount
  const total = Math.max(0, subtotal - activeDiscount)
  const availableItems = cart.filter((item) => !item.unavailable)
  const allSelected =
    availableItems.length > 0 && selectedKeys.length === availableItems.length

  const toggleItem = (key: string) => {
    setSelectedKeys((current) =>
      current.includes(key)
        ? current.filter((itemKey) => itemKey !== key)
        : [...current, key],
    )
  }

  const submitPromo = () => {
    if (applyPromo(code, subtotal)) {
      setPromoError("")
      addToast(`Mã ${code.trim().toUpperCase()} đã được áp dụng`)
    } else {
      const promotion = getPromotion(code)
      setPromoError(
        promotion
          ? `Đơn hàng chưa đạt mức tối thiểu ${formatCurrency(promotion.minSpend)}.`
          : "Mã không hợp lệ hoặc không còn được áp dụng.",
      )
    }
  }

  if (cart.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <EmptyState
          title="Giỏ hàng đang chờ món ngon"
          description="Bạn chưa thêm thức uống nào. Hãy khám phá menu và chọn món hợp mood hôm nay."
          action={<ButtonLink to="/#menu">Khám phá menu</ButtonLink>}
        />
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-14 lg:px-8">
      <PageTitle
        eyebrow="Đơn hàng của bạn"
        title="Giỏ hàng"
        description={`${cart.length} lựa chọn đang chờ được pha mới.`}
      />
      <div className="mt-9 grid gap-8 lg:grid-cols-[1fr_25rem] lg:items-start">
        <div className="space-y-4">
          <button
            onClick={() =>
              setSelectedKeys(
                allSelected ? [] : availableItems.map((item) => item.key),
              )
            }
            className="flex items-center gap-3 rounded-xl px-1 py-2 text-sm font-semibold text-[#5f4b40]"
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
          {cart.map((item) => (
            <article
              key={item.key}
              className="relative grid grid-cols-[5.5rem_1fr] gap-4 rounded-[1.5rem] border border-[#e3d9cf] bg-white p-3.5 pl-11 shadow-[0_10px_35px_rgba(65,42,31,0.05)] sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:p-4 sm:pl-12"
            >
              <button
                onClick={() => toggleItem(item.key)}
                disabled={item.unavailable}
                className="absolute left-3 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9845a]/25 disabled:cursor-not-allowed disabled:opacity-40 sm:left-4"
                aria-label={
                  selectedKeys.includes(item.key)
                    ? `Bỏ chọn ${item.name}`
                    : `Chọn ${item.name}`
                }
              >
                <span
                  className={
                    selectedKeys.includes(item.key)
                      ? "grid size-5 place-items-center rounded-md border border-[#648066] bg-[#648066] text-white"
                      : "grid size-5 place-items-center rounded-md border border-[#b8a79c] bg-white"
                  }
                >
                  {selectedKeys.includes(item.key) && <Check size={13} />}
                </span>
              </button>
              <img
                src={item.image}
                alt={item.name}
                className="aspect-square h-full w-full rounded-2xl object-cover"
              />
              <div className="min-w-0">
                <h2 className="font-serif text-xl text-[#302018]">
                  {item.name}
                </h2>
                {item.unavailable && (
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
                  Size {item.size.id} · {item.size.label.split(" · ")[1]}
                </p>
                <p className="mt-1 truncate text-xs text-[#958379]">
                  {item.toppings.length
                    ? item.toppings.map((topping) => topping.name).join(", ")
                    : "Không thêm topping"}
                </p>
                <p className="mt-1 text-xs text-[#958379]">
                  Ngọt {item.sweetness?.value ?? 100}% · Đá{" "}
                  {item.ice?.value ?? 100}%
                </p>
                <div className="mt-3 w-full max-w-xs">
                  <label
                    htmlFor={`note-${item.key}`}
                    className="mb-1.5 block text-xs font-semibold text-[#6f5b50]"
                  >
                    Ghi chú cho món
                  </label>
                  <TextArea
                    id={`note-${item.key}`}
                    value={item.note ?? ""}
                    onChange={(event) =>
                      updateItemNote(item.key, event.target.value.slice(0, 80))
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
                <p className="mt-3 font-bold text-[#4c352a] sm:hidden">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </p>
              </div>
              <div className="col-span-2 flex items-center justify-between border-t border-[#eee7e0] pt-3 sm:col-span-1 sm:flex-col sm:items-end sm:border-0 sm:pt-0">
                <p className="hidden font-bold text-[#4c352a] sm:block">
                  {formatCurrency(item.unitPrice * item.quantity)}
                </p>
                <div className="flex items-center gap-2 sm:mt-4">
                  <div className="flex items-center rounded-full border border-[#ddd2c8] p-0.5">
                    <button
                      className="grid size-8 place-items-center rounded-full hover:bg-[#eee6dc] disabled:opacity-40"
                      onClick={() =>
                        updateQuantity(item.key, Math.max(1, item.quantity - 1))
                      }
                      disabled={item.quantity === 1 || item.unavailable}
                      aria-label={`Giảm số lượng ${item.name}`}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="min-w-7 text-center text-sm font-bold">
                      {item.quantity}
                    </span>
                    <button
                      className="grid size-8 place-items-center rounded-full hover:bg-[#eee6dc]"
                      onClick={() =>
                        updateQuantity(item.key, item.quantity + 1)
                      }
                      disabled={item.isReward || item.unavailable}
                      aria-label={`Tăng số lượng ${item.name}`}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <button
                    className="grid size-9 place-items-center rounded-full text-[#9b4a40] hover:bg-[#fff0ed]"
                    onClick={() => setPendingRemoval(item.key)}
                    aria-label={`Xóa ${item.name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
          <ButtonLink to="/#menu" variant="ghost">
            <ArrowLeft size={17} /> Tiếp tục mua sắm
          </ButtonLink>
        </div>

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
            <Button variant="secondary" onClick={submitPromo}>
              Áp dụng
            </Button>
          </div>
          {promoError && (
            <div className="mt-3">
              <InlineNotice type="error">{promoError}</InlineNotice>
            </div>
          )}
          {promoCode && !promoError && (
            <div className="mt-3">
              <InlineNotice>Đã áp dụng {promoCode}</InlineNotice>
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
            <span className="font-semibold">Tổng thanh toán</span>
            <span className="text-xl font-bold text-[#3b281f]">
              {formatCurrency(total)}
            </span>
          </div>
          <Button
            fullWidth
            size="lg"
            className="mt-6"
            disabled={selectedKeys.length === 0}
            onClick={() => {
              setCheckoutSelection(selectedKeys)
              navigate("/checkout")
            }}
          >
            Thanh toán{" "}
            {selectedKeys.length > 0 ? `${selectedKeys.length} món` : ""}
          </Button>
          <p className="mt-3 text-center text-xs leading-5 text-[#958278]">
            Số tiền cuối cùng sẽ được xác nhận lại khi đặt hàng.
          </p>
        </aside>
      </div>

      {pendingRemoval && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-[#241710]/45 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-title"
        >
          <div className="w-full max-w-sm rounded-[1.75rem] bg-white p-6 shadow-2xl">
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
              <Button
                variant="danger"
                onClick={() => {
                  removeFromCart(pendingRemoval)
                  setSelectedKeys((current) =>
                    current.filter((key) => key !== pendingRemoval),
                  )
                  setPendingRemoval(null)
                  addToast("Đã xóa sản phẩm khỏi giỏ", "info")
                }}
              >
                Xóa sản phẩm
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
