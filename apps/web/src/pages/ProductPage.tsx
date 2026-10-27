import { ArrowLeft, Check, CheckCircle2, Package, Plus, ShieldCheck } from "lucide-react"
import { Link, useParams } from "react-router-dom"
import { useEffect, useState } from "react"
import { catalogService } from "../services/catalogService"
import { cartService } from "../services/cartService"
import { useAuth } from "../contexts/AuthContext"
import type { Product, Topping } from "../types"

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value) + " đ"

// Hàm chuyển đổi nhãn phần trăm sang enum Database (Prisma DrinkLevel)
const mapLevelToEnum = (level: string): 'ZERO' | 'FIFTY' | 'HUNDRED' | 'ONE_TWENTY' => {
  switch (level) {
    case '120%': return 'ONE_TWENTY';
    case '100%': return 'HUNDRED';
    case '50%': return 'FIFTY';
    case '0%': return 'ZERO';
    default: return 'HUNDRED';
  }
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [selectedSize, setSelectedSize] = useState<string | null>(null)
  const [toppings, setToppings] = useState<Topping[]>([])
  const [selectedToppings, setSelectedToppings] = useState<string[]>([])
  const [sweetness, setSweetness] = useState("100%")
  const [ice, setIce] = useState("100%")
  const [quantity, setQuantity] = useState(1)

  // State cho quá trình bấm nút thêm vào giỏ
  const [adding, setAdding] = useState(false)
  const [addSuccess, setAddSuccess] = useState(false)

  useEffect(() => {
    if (!id) return
    const loadProduct = async () => {
      try {
        setLoading(true)
        setError("")
        const [data, toppingData] = await Promise.all([
          catalogService.getProductById(id),
          catalogService.getToppings(),
        ])
        setProduct(data)
        setToppings(toppingData)
        setSelectedSize(data.sizes[0]?.id ?? null)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Không thể tải sản phẩm")
      } finally {
        setLoading(false)
      }
    }
    void loadProduct()
  }, [id])

  if (loading) {
    return <div className="mx-auto flex min-h-[70vh] max-w-7xl items-center justify-center text-[#735b4e]">Đang tải thông tin sản phẩm...</div>
  }

  if (error || !product) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-7xl flex-col items-center justify-center px-6 text-center">
        <Package size={42} className="text-[#8a7567]" />
        <h1 className="mt-5 font-serif text-3xl text-[#302018]">Không tìm thấy sản phẩm</h1>
        <p className="mt-2 text-[#7e6b60]">{error || "Sản phẩm không còn khả dụng."}</p>
        <Link to="/" className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#3b241c] px-5 py-3 text-sm font-semibold text-white">
          <ArrowLeft size={17} /> Quay lại menu
        </Link>
      </div>
    )
  }

  const selected = product.sizes.find((size) => size.id === selectedSize) ?? product.sizes[0]
  const price = product.basePrice + (selected?.priceAdjustment ?? 0)
  const toppingTotal = toppings
    .filter((topping) => selectedToppings.includes(topping.id))
    .reduce((total, topping) => total + topping.price, 0)
  const total = (price + toppingTotal) * quantity

  const toggleTopping = (id: string) => {
    setSelectedToppings((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : current.length < 3
          ? [...current, id]
          : current,
    )
  }

  // 2. Hàm xử lý khi bấm nút "Thêm vào giỏ"
  const handleAddToCart = async () => {
    if (!product || !selected?.id) return
    try {
      setAdding(true)
      await cartService.addToCart({
        productId: product.id,
        productName: product.name,
        imageUrl: product.imageUrl,
        size: selected.size,
        productSizeId: selected.id,
        sweetnessLevel: mapLevelToEnum(sweetness),
        iceLevel: mapLevelToEnum(ice),
        quantity,
        unitPrice: price + toppingTotal,
        toppingIds: selectedToppings,
        toppings: toppings.filter(t => selectedToppings.includes(t.id)), // 👈 Bổ sung tên topping
      }, !!user)

      setAddSuccess(true)
      setTimeout(() => setAddSuccess(false), 2000)
    } catch (err: any) {
      alert(err.message || "Thêm vào giỏ hàng thất bại")
    } finally {
      setAdding(false)
    }
  }

  const isOutOfStock = product.stockQuantity <= 0

  return (
    <main className="mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 lg:px-10">
      <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#725f54] transition hover:text-[#3b241c]">
        <ArrowLeft size={18} /> Quay lại menu
      </Link>

      <section className="mt-10 grid gap-12 lg:grid-cols-[1.02fr_0.98fr] lg:items-start lg:gap-16">
        <div className="overflow-hidden rounded-[2.25rem] bg-[#e9e1d7] shadow-[0_18px_55px_rgba(68,44,32,0.1)] lg:sticky lg:top-28">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="aspect-[1.08/1] h-full w-full object-cover" />
          ) : (
            <div className="grid aspect-[1.08/1] place-items-center text-[#8a7567]">Chưa có hình ảnh</div>
          )}
        </div>

        <div className="pt-2 lg:pt-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#806857]">{product.category.name}</p>
          <h1 className="mt-5 font-serif text-5xl leading-[1.02] tracking-[-0.04em] text-[#302018] sm:text-6xl">{product.name}</h1>
          <p className="mt-6 font-serif text-2xl font-semibold text-[#3c2a22]">{formatCurrency(price)}</p>
          <p className="mt-7 max-w-xl text-base leading-8 text-[#7e6b60]">{product.description || "Một thức uống được pha mới từ những nguyên liệu được tuyển chọn kỹ lưỡng."}</p>

          <div className="mt-7 flex items-center gap-3 border-b border-[#e5dbd1] pb-7 text-sm text-[#637a64]">
            <ShieldCheck size={20} />
            {!isOutOfStock ? `Còn ${product.stockQuantity} phần hôm nay` : <span className="font-bold text-red-600">Tạm hết hàng</span>}
          </div>

          <div className="mt-7">
            <p className="text-sm font-bold text-[#3b2a22]">Chọn kích cỡ</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {product.sizes.map((size) => (
                <button key={size.id} type="button" onClick={() => setSelectedSize(size.id)} className={`min-w-20 rounded-2xl border px-5 py-3 text-sm font-semibold transition ${selectedSize === size.id ? "border-[#3b241c] bg-[#3b241c] text-white" : "border-[#ddd2c8] bg-white text-[#6c584d] hover:border-[#9c806d]"}`}>
                  Size {size.size}
                  {size.priceAdjustment > 0 && <span className="ml-1 text-xs opacity-70">+{formatCurrency(size.priceAdjustment)}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-9 border-t border-[#e5dbd1] pt-8">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl text-[#3b2a22]">Thêm topping</h2>
              <span className="text-sm text-[#8a7567]">Tối đa 3 lựa chọn</span>
            </div>
            <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
              {toppings.map((topping) => {
                const selectedTopping = selectedToppings.includes(topping.id)
                return (
                  <button key={topping.id} type="button" onClick={() => toggleTopping(topping.id)} className={`flex w-full items-center justify-between rounded-2xl border bg-white px-6 py-4 text-left transition ${selectedTopping ? "border-[#769178] bg-[#edf4eb]" : "border-[#e0d4c9] hover:border-[#b99d87]"}`}>
                    <span className="flex items-center gap-4 text-base font-semibold text-[#49352b]">
                      <span className={`grid size-8 place-items-center rounded-lg border ${selectedTopping ? "border-[#6f8e70] bg-[#6f8e70] text-white" : "border-[#c8b3a3] text-transparent"}`}><Check size={17} /></span>
                      {topping.name}
                    </span>
                    <span className="text-[#806f64]">+{formatCurrency(topping.price)}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <OptionGroup title="Độ ngọt" options={["120%", "100%", "50%", "0%"]} value={sweetness} onChange={setSweetness} />
          <OptionGroup title="Mức đá" options={["120%", "100%", "50%", "0%"]} value={ice} onChange={setIce} />

          <div className="mt-9 flex items-center justify-between gap-5">
            <h2 className="font-serif text-2xl text-[#3b2a22]">Số lượng</h2>
            <div className="flex items-center gap-7 rounded-full border border-[#e0d4c9] bg-white px-5 py-3">
              <button type="button" aria-label="Giảm số lượng" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="text-2xl text-[#8d796d]">−</button>
              <span className="min-w-4 text-center font-bold text-[#3b2a22]">{quantity}</span>
              <button type="button" aria-label="Tăng số lượng" onClick={() => setQuantity((value) => Math.min(product.stockQuantity, value + 1))} className="text-2xl text-[#3b2a22]">+</button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-5 rounded-[2rem] bg-[#eee6dc] p-5 shadow-[0_12px_35px_rgba(68,44,32,0.12)] sm:p-6">
            <div>
              <p className="text-sm text-[#89766a]">Tổng cộng</p>
              <p className="mt-1 font-serif text-3xl font-semibold text-[#3b2a22]">{formatCurrency(total)}</p>
            </div>

            {/* 3. NÚT THÊM VÀO GIỎ ĐÃ ĐƯỢC MỞ KHÓA VÀ NỐI HÀM ONCLICK */}
            <button
              type="button"
              disabled={isOutOfStock || adding}
              onClick={handleAddToCart}
              className={`inline-flex min-h-16 items-center gap-2 rounded-full px-8 text-base font-bold text-white shadow-[0_10px_25px_rgba(59,36,28,0.18)] transition-all ${isOutOfStock
                ? "bg-gray-400 cursor-not-allowed opacity-60"
                : addSuccess
                  ? "bg-green-700 hover:bg-green-800 scale-105"
                  : "bg-[#3b241c] hover:bg-[#523428] active:scale-95"
                }`}
            >
              {addSuccess ? (
                <>
                  <Check size={22} /> Đã thêm vào giỏ!
                </>
              ) : (
                <>
                  <Plus size={22} /> {adding ? "Đang thêm..." : isOutOfStock ? "Tạm hết hàng" : "Thêm vào giỏ"}
                </>
              )}
            </button>
          </div>

          <div className="mt-8 flex items-center gap-3 rounded-2xl bg-[#f1ebe4] px-4 py-4 text-sm text-[#654d3f]">
            <CheckCircle2 size={19} className="text-[#708c70]" />
            Sản phẩm được pha mới sau khi đặt hàng
          </div>
        </div>
      </section>
    </main>
  )
}

function OptionGroup({ title, options, value, onChange }: { title: string; options: string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="mt-9">
      <h2 className="font-serif text-2xl text-[#3b2a22]">{title}</h2>
      <div className="mt-4 max-h-64 space-y-3 overflow-y-auto pr-1">
        {options.map((option) => (
          <button key={option} type="button" onClick={() => onChange(option)} className={`flex w-full items-center justify-between rounded-2xl border px-6 py-4 text-left transition ${value === option ? "border-[#769178] bg-[#edf4eb]" : "border-[#e0d4c9] bg-white hover:border-[#b99d87]"}`}>
            <span><span className="block text-base font-semibold text-[#49352b]">{option === "120%" ? "Nhiều" : option === "100%" ? "Bình thường" : option === "0%" ? "Không" : "Ít"}</span><span className="mt-1 block text-sm text-[#907d70]">{option}</span></span>
            <span className={`grid size-8 place-items-center rounded-full border ${value === option ? "border-[#6f8e70] bg-[#6f8e70] text-white" : "border-[#c8b3a3] text-transparent"}`}><Check size={17} /></span>
          </button>
        ))}
      </div>
    </div>
  )
}