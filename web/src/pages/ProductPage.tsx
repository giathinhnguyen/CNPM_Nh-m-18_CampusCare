import { useMemo, useState } from "react"
import {
  ArrowLeft,
  Check,
  Minus,
  Plus,
  ShieldCheck,
} from "lucide-react"
import { Link, Navigate, useParams } from "react-router-dom"
import { defaultDrinkLevel, drinkLevels, products } from "../data/products"
import { createCartKey, formatCurrency } from "../lib/utils"
import { useAppStore } from "../store/useAppStore"
import { Button, cx } from "../components/ui"
import type { DrinkLevel } from "../types"

export default function ProductPage() {
  const { id } = useParams()
  const product = products.find((item) => item.id === id)
  const [sizeId, setSizeId] = useState<"S" | "M" | "L">("M")
  const [selectedToppings, setSelectedToppings] = useState<string[]>([])
  const [sweetness, setSweetness] = useState<DrinkLevel>(defaultDrinkLevel)
  const [ice, setIce] = useState<DrinkLevel>(defaultDrinkLevel)
  const [quantity, setQuantity] = useState(1)
  const { addToCart, addToast } = useAppStore()

  if (!product) return <Navigate to="/404" replace />

  const size = product.sizes.find((item) => item.id === sizeId) ?? product.sizes[0]
  const toppings = product.toppings.filter((item) =>
    selectedToppings.includes(item.id),
  )
  const unitPrice = useMemo(
    () => product.price + size.extra + toppings.reduce((sum, item) => sum + item.price, 0),
    [product.price, size.extra, toppings],
  )

  const toggleTopping = (toppingId: string) => {
    setSelectedToppings((current) =>
      current.includes(toppingId)
        ? current.filter((id) => id !== toppingId)
        : current.length < 3
          ? [...current, toppingId]
          : current,
    )
  }

  const addItem = () => {
    addToCart({
      key: createCartKey(product.id, size, toppings, sweetness, ice),
      productId: product.id,
      name: product.name,
      image: product.image,
      size,
      toppings,
      sweetness,
      ice,
      note: "",
      unitPrice,
      quantity,
    })
    addToast(`Đã thêm ${quantity} ${product.name} vào giỏ`)
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-12 lg:px-8">
      <Link
        to="/#menu"
        className="inline-flex items-center gap-2 rounded-full py-2 text-sm font-semibold text-[#6c584d] transition hover:text-[#302018]"
      >
        <ArrowLeft size={18} /> Quay lại menu
      </Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="relative aspect-[4/4.7] overflow-hidden rounded-[2rem] bg-[#e6ddd3] lg:sticky lg:top-24 lg:aspect-[4/4.5]">
          <img
            src={product.image}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="py-2 lg:py-8">
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#7d6657]">
            {product.category}
          </span>
          <h1 className="mt-3 font-serif text-4xl leading-tight tracking-tight text-[#302018] md:text-5xl">
            {product.name}
          </h1>
          <p className="mt-3 text-xl font-bold text-[#50382d]">
            {formatCurrency(product.price)}
          </p>
          <p className="mt-5 max-w-xl leading-7 text-[#77645a]">
            {product.longDescription}
          </p>
          <div className="mt-5 flex items-center gap-2 text-sm text-[#59715a]">
            <ShieldCheck size={18} />
            {product.stock > 0 ? `Còn ${product.stock} phần hôm nay` : "Tạm hết hàng"}
          </div>

          <div className="my-8 h-px bg-[#e2d8cf]" />

          <fieldset>
            <legend className="flex w-full items-center justify-between font-semibold text-[#38271f]">
              Chọn kích cỡ
              <span className="text-xs font-normal text-[#8c7a70]">Bắt buộc</span>
            </legend>
            <div className="mt-3 grid grid-cols-3 gap-2.5">
              {product.sizes.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setSizeId(item.id)}
                  className={cx(
                    "relative min-h-20 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9845a]/20",
                    sizeId === item.id
                      ? "border-[#4b3429] bg-[#f1eae2]"
                      : "border-[#dfd5cc] bg-white hover:border-[#ad9584]",
                  )}
                >
                  <span className="block font-bold">{item.id}</span>
                  <span className="mt-1 block text-xs text-[#7f6d62]">
                    +{formatCurrency(item.extra)}
                  </span>
                  {sizeId === item.id && (
                    <Check
                      size={15}
                      className="absolute right-3 top-3 text-[#4b6c4d]"
                    />
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-8">
            <legend className="flex w-full items-center justify-between font-semibold text-[#38271f]">
              Thêm topping
              <span className="text-xs font-normal text-[#8c7a70]">
                Tối đa 3 lựa chọn
              </span>
            </legend>
            <div className="mt-3 max-h-52 space-y-2.5 overflow-y-auto overscroll-contain pr-2 [scrollbar-color:#bda99b_transparent] [scrollbar-width:thin]">
              {product.toppings.map((item) => {
                const checked = selectedToppings.includes(item.id)
                return (
                  <button
                    key={item.id}
                    onClick={() => toggleTopping(item.id)}
                    className={cx(
                      "flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9845a]/20",
                      checked
                        ? "border-[#6d846d] bg-[#edf3eb]"
                        : "border-[#dfd5cc] bg-white hover:border-[#ad9584]",
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={cx(
                          "grid size-5 place-items-center rounded-md border",
                          checked
                            ? "border-[#648066] bg-[#648066] text-white"
                            : "border-[#b8a79c]",
                        )}
                      >
                        {checked && <Check size={13} />}
                      </span>
                      <span className="text-sm font-medium">{item.name}</span>
                    </span>
                    <span className="text-sm text-[#77645a]">
                      +{formatCurrency(item.price)}
                    </span>
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="mt-8 space-y-8">
            <DrinkLevelSelector
              legend="Độ ngọt"
              value={sweetness}
              onChange={setSweetness}
            />
            <DrinkLevelSelector
              legend="Mức đá"
              value={ice}
              onChange={setIce}
            />
          </div>

          <div className="mt-8 flex items-center justify-between">
            <span className="font-semibold">Số lượng</span>
            <div className="flex items-center gap-4 rounded-full border border-[#ddd2c8] bg-white p-1">
              <button
                className="grid size-9 place-items-center rounded-full transition hover:bg-[#eee6dc] disabled:opacity-40"
                onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                disabled={quantity <= 1}
                aria-label="Giảm số lượng"
              >
                <Minus size={16} />
              </button>
              <span className="min-w-4 text-center text-sm font-bold">{quantity}</span>
              <button
                className="grid size-9 place-items-center rounded-full transition hover:bg-[#eee6dc] disabled:opacity-40"
                onClick={() =>
                  setQuantity((value) => Math.min(product.stock, value + 1))
                }
                disabled={quantity >= product.stock}
                aria-label="Tăng số lượng"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="mt-8 rounded-[1.5rem] bg-[#eee6dc] p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
            <div className="mb-3 sm:mb-0">
              <p className="text-xs text-[#837066]">Tổng cộng</p>
              <p className="mt-0.5 text-xl font-bold text-[#39271f]">
                {formatCurrency(unitPrice * quantity)}
              </p>
            </div>
            <Button
              size="lg"
              className="w-full sm:w-auto"
              onClick={addItem}
              disabled={product.stock === 0}
            >
              <Plus size={18} /> Thêm vào giỏ
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function DrinkLevelSelector({
  legend,
  value,
  onChange,
}: {
  legend: string
  value: DrinkLevel
  onChange: (level: DrinkLevel) => void
}) {
  return (
    <fieldset>
      <legend className="font-semibold text-[#38271f]">{legend}</legend>
      <div className="mt-3 max-h-40 space-y-2.5 overflow-y-auto overscroll-contain pr-2 [scrollbar-color:#bda99b_transparent] [scrollbar-width:thin]">
        {drinkLevels.map((level) => (
          <button
            key={level.value}
            type="button"
            onClick={() => onChange(level)}
            className={cx(
              "flex min-h-14 w-full items-center justify-between rounded-2xl border px-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9845a]/20",
              value.value === level.value
                ? "border-[#5d765e] bg-[#edf3eb]"
                : "border-[#dfd5cc] bg-white hover:border-[#ad9584]",
            )}
          >
            <span>
              <span className="block text-sm font-semibold">{level.label}</span>
              <span className="mt-0.5 block text-xs text-[#837167]">
                {level.value}%
              </span>
            </span>
            <span
              className={cx(
                "grid size-5 place-items-center rounded-full border",
                value.value === level.value
                  ? "border-[#648066] bg-[#648066] text-white"
                  : "border-[#b8a79c]",
              )}
            >
              {value.value === level.value && <Check size={12} />}
            </span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
