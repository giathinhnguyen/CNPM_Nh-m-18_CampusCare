import { ArrowUpRight, Plus } from "lucide-react"
import { Link, useNavigate } from "react-router-dom"
import { formatCurrency, createCartKey } from "../lib/utils"
import { useAppStore } from "../store/useAppStore"
import type { Product } from "../types"
import { Button } from "./ui"
import { defaultDrinkLevel } from "../data/products"

export default function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate()
  const { addToCart, addToast } = useAppStore()

  const quickAdd = () => {
    if (product.stock === 0) return
    const size = product.sizes[0]
    const sweetness = defaultDrinkLevel
    const ice = defaultDrinkLevel
    addToCart({
      key: createCartKey(product.id, size, [], sweetness, ice),
      productId: product.id,
      name: product.name,
      image: product.image,
      size,
      toppings: [],
      sweetness,
      ice,
      note: "",
      unitPrice: product.price + size.extra,
      quantity: 1,
    })
    addToast(`Đã thêm ${product.name} vào giỏ`)
  }

  return (
    <article className="group overflow-hidden rounded-[1.75rem] border border-[#e4dad0] bg-white shadow-[0_12px_40px_rgba(68,44,32,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_48px_rgba(68,44,32,0.12)]">
      <Link
        to={`/products/${product.id}`}
        className="relative block aspect-[4/4.5] overflow-hidden bg-[#e9e1d7]"
        aria-label={`Xem ${product.name}`}
      >
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-4">
          <span className="ml-auto grid size-9 place-items-center rounded-full bg-white/90 text-[#422c23] opacity-0 backdrop-blur transition group-hover:opacity-100">
            <ArrowUpRight size={17} />
          </span>
        </div>
        {product.stock === 0 && (
          <div className="absolute inset-0 grid place-items-center bg-[#302018]/45 backdrop-blur-[2px]">
            <span className="rounded-full bg-white px-4 py-2 text-sm font-bold text-[#4c352a]">
              Tạm hết hàng
            </span>
          </div>
        )}
      </Link>
      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8a7567]">
            {product.category}
          </span>
        </div>
        <Link to={`/products/${product.id}`}>
          <h2 className="mt-2 font-serif text-[1.35rem] leading-snug text-[#302018] transition group-hover:text-[#71503d]">
            {product.name}
          </h2>
        </Link>
        <p className="mt-1.5 line-clamp-2 min-h-10 text-sm leading-5 text-[#7e6b60]">
          {product.description}
        </p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <div>
            <p className="font-bold text-[#3c2a22]">
              {formatCurrency(product.price)}
            </p>
          </div>
          <Button
            size="sm"
            disabled={product.stock === 0}
            onClick={() =>
              window.innerWidth < 640 ? navigate(`/products/${product.id}`) : quickAdd()
            }
            aria-label={`Thêm nhanh ${product.name}`}
          >
            <Plus size={16} /> <span className="hidden sm:inline">Thêm</span>
          </Button>
        </div>
      </div>
    </article>
  )
}
