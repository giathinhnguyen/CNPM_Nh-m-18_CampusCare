import { useEffect, useMemo, useState } from "react"
import {
  AlertCircle,
  Check,
  Gift,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
} from "lucide-react"
import {
  getRewardCatalog,
  isRewardsMockMode,
  redeemRewardProduct,
} from "../services/rewardService"
import { useAppStore } from "../store/useAppStore"
import type { RewardCatalog } from "../types"
import { Button, InlineNotice, cx } from "./ui"

type LoadState = "loading" | "success" | "error"

export default function RewardsRedemption() {
  const [catalog, setCatalog] = useState<RewardCatalog | null>(null)
  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState("")
  const { cart, addToCart, addToast, loyaltyPoints } = useAppStore()
  const hasRewardInCart = cart.some((item) => item.isReward)
  const pointsBalance =
    isRewardsMockMode ? loyaltyPoints : (catalog?.pointsBalance ?? 0)

  const loadRewards = () => {
    const controller = new AbortController()
    setLoadState("loading")
    setMessage("")
    getRewardCatalog(controller.signal)
      .then((data) => {
        setCatalog(data)
        setLoadState("success")
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách đổi thưởng.",
        )
        setLoadState("error")
      })
    return controller
  }

  useEffect(() => {
    const controller = loadRewards()
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (hasRewardInCart) setSelectedCode(null)
  }, [hasRewardInCart])

  const selectedProduct = useMemo(
    () =>
      catalog?.products.find((product) => product.productCode === selectedCode) ??
      null,
    [catalog, selectedCode],
  )

  const redeem = async () => {
    if (!selectedProduct || submitting || hasRewardInCart) return
    setSubmitting(true)
    setMessage("")
    try {
      const result = await redeemRewardProduct(
        selectedProduct.productCode,
        pointsBalance,
      )
      addToCart(result.cartItem)
      setSelectedCode(null)
      addToast(`Đã thêm ${result.cartItem.name} vào giỏ với giá 0đ`)
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể đổi điểm lúc này. Vui lòng thử lại.",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="px-6 py-8 sm:px-10 md:px-12 lg:px-16 lg:py-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5d765e]">
            Đặc quyền thành viên
          </p>
          <h3 className="mt-2 font-serif text-3xl text-[#263b2a]">
            Đổi điểm lấy đồ uống
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#58705b]">
            Chọn một món đủ điều kiện. Điểm chỉ được trừ sau khi thanh toán thành
            công.
          </p>
        </div>
        {catalog && (
          <div className="shrink-0 rounded-2xl bg-[#fbf8f3] px-5 py-3 text-right shadow-sm">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[#7b8c78]">
              Điểm hiện có
            </p>
            <p className="mt-0.5 font-serif text-2xl text-[#36503a]">
              {pointsBalance.toLocaleString("vi-VN")} điểm
            </p>
          </div>
        )}
      </div>

      {hasRewardInCart && (
        <div className="mt-5">
          <InlineNotice type="info">
            Giỏ hàng của bạn đã có sản phẩm đổi thưởng. Vui lòng xóa sản phẩm đổi
            thưởng hiện tại hoặc hoàn tất thanh toán để tiếp tục đổi điểm.
          </InlineNotice>
        </div>
      )}

      {loadState === "loading" && (
        <div className="mt-6 flex min-h-48 items-center justify-center gap-3 rounded-2xl bg-white/45 text-sm font-medium text-[#58705b]">
          <LoaderCircle className="animate-spin" size={20} />
          Đang tải sản phẩm đổi thưởng...
        </div>
      )}

      {loadState === "error" && (
        <div className="mt-6 flex min-h-48 flex-col items-center justify-center rounded-2xl border border-[#c7d4c3] bg-white/45 p-6 text-center">
          <AlertCircle className="text-[#6b7f68]" size={27} />
          <p className="mt-3 text-sm font-semibold text-[#354d39]">
            Chưa thể tải sản phẩm đổi thưởng
          </p>
          <p className="mt-1 max-w-md text-xs leading-5 text-[#647667]">
            {message}
          </p>
          <Button
            className="mt-4"
            size="sm"
            variant="secondary"
            onClick={loadRewards}
          >
            <RefreshCw size={15} /> Thử lại
          </Button>
        </div>
      )}

      {loadState === "success" && catalog?.products.length === 0 && (
        <div className="mt-6 flex min-h-48 flex-col items-center justify-center rounded-2xl bg-white/45 p-6 text-center">
          <Gift className="text-[#668067]" size={28} />
          <p className="mt-3 font-semibold text-[#354d39]">
            Chưa có món đổi thưởng
          </p>
          <p className="mt-1 text-xs text-[#647667]">
            Các món mới sẽ sớm được cập nhật.
          </p>
        </div>
      )}

      {loadState === "success" && catalog && catalog.products.length > 0 && (
        <>
          <div className="mt-6 flex snap-x gap-4 overflow-x-auto pb-4 [scrollbar-color:#9db19a_transparent] [scrollbar-width:thin]">
            {catalog.products.map((product) => {
              const enoughPoints = pointsBalance >= product.pointsRequired
              const canRedeem =
                product.allowed && enoughPoints && !hasRewardInCart
              const selected = selectedCode === product.productCode
              const status = hasRewardInCart
                ? "Không thể đổi"
                : !product.allowed
                  ? "Không thể đổi"
                  : enoughPoints
                    ? "Đủ điểm"
                    : "Không đủ điểm"

              return (
                <button
                  key={product.productCode}
                  type="button"
                  disabled={!canRedeem}
                  onClick={() =>
                    setSelectedCode((current) =>
                      current === product.productCode ? null : product.productCode,
                    )
                  }
                  className={cx(
                    "relative w-48 shrink-0 snap-start overflow-hidden rounded-2xl border bg-[#fbf8f3] text-left transition sm:w-52",
                    selected
                      ? "border-[#526f56] ring-4 ring-[#789278]/20"
                      : "border-[#cbd7c7]",
                    canRedeem
                      ? "hover:-translate-y-0.5 hover:shadow-lg"
                      : "cursor-not-allowed opacity-70",
                  )}
                >
                  <img
                    src={product.image}
                    alt={product.name}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <div className="p-4">
                    <p className="line-clamp-2 min-h-10 text-sm font-semibold text-[#304533]">
                      {product.name}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <span className="text-sm font-bold text-[#49634c]">
                        {product.pointsRequired.toLocaleString("vi-VN")} điểm
                      </span>
                      <span
                        className={cx(
                          "text-[0.65rem] font-bold uppercase tracking-wide",
                          canRedeem ? "text-[#55735a]" : "text-[#947069]",
                        )}
                      >
                        {status}
                      </span>
                    </div>
                  </div>
                  {selected && (
                    <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-[#527155] text-white shadow-md">
                      <Check size={15} />
                    </span>
                  )}
                  {hasRewardInCart && (
                    <span className="absolute left-3 top-3 grid size-7 place-items-center rounded-full bg-white/90 text-[#637264]">
                      <LockKeyhole size={14} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {message && (
            <div className="mb-4">
              <InlineNotice type="error">{message}</InlineNotice>
            </div>
          )}

          <Button
            onClick={redeem}
            disabled={
              !selectedProduct ||
              submitting ||
              hasRewardInCart ||
              !selectedProduct.allowed ||
              pointsBalance < selectedProduct.pointsRequired
            }
          >
            {submitting ? (
              <>
                <LoaderCircle className="animate-spin" size={17} /> Đang xử lý...
              </>
            ) : (
              <>
                <Gift size={17} /> Đổi điểm
              </>
            )}
          </Button>
        </>
      )}
    </section>
  )
}
