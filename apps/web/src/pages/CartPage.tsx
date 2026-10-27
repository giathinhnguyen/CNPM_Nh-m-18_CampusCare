import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { ArrowLeft, Minus, Plus, Trash2, ShoppingBag, AlertCircle, LogIn } from "lucide-react"
import { cartService } from "../services/cartService"
import { useAuth } from "../contexts/AuthContext"

const formatCurrency = (value: number) =>
    new Intl.NumberFormat("vi-VN").format(value) + " đ"

// 👉 Hàm chuyển đổi Enum Database sang tiếng Việt 100% chuẩn người dùng
const formatLevel = (level: string) => {
    if (!level) return "100%"
    switch (level.toUpperCase()) {
        case "ONE_TWENTY": return "120%"
        case "HUNDRED": return "100%"
        case "FIFTY": return "50%"
        case "ZERO": return "0%"
        default: return level.includes("%") ? level : `${level}%`
    }
}

export default function CartPage() {
    const { user } = useAuth() // Trạng thái đăng nhập
    const navigate = useNavigate()

    const [cart, setCart] = useState<{
        items: any[]
        totalAmount: number
        totalItems: number
    }>({ items: [], totalAmount: 0, totalItems: 0 })

    const [loading, setLoading] = useState(true)
    const [updatingId, setUpdatingId] = useState<string | null>(null)

    // 1. Tải giỏ hàng
    const fetchCart = async () => {
        try {
            setLoading(true)
            const data = await cartService.getCart(!!user)
            setCart(data)
        } catch (err) {
            console.error("Lỗi lấy giỏ hàng:", err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void fetchCart()
    }, [user])

    // 2. Tăng / Giảm số lượng
    const handleUpdateQuantity = async (itemId: string, currentQty: number, delta: number) => {
        const newQty = currentQty + delta
        try {
            setUpdatingId(itemId)
            if (newQty <= 0) {
                await cartService.removeItem(itemId, !!user)
            } else {
                await cartService.updateQuantity(itemId, newQty, !!user)
            }
            await fetchCart()
        } catch (err: any) {
            alert(err.message || "Không thể cập nhật số lượng")
        } finally {
            setUpdatingId(null)
        }
    }

    // 3. Xóa món
    const handleRemoveItem = async (itemId: string) => {
        if (!confirm("Bạn có chắc muốn xóa món này khỏi giỏ hàng?")) return
        try {
            setUpdatingId(itemId)
            await cartService.removeItem(itemId, !!user)
            await fetchCart()
        } catch (err: any) {
            alert(err.message || "Không thể xóa món")
        } finally {
            setUpdatingId(null)
        }
    }

    // 4. 👉 XỬ LÝ NÚT THANH TOÁN THEO ĐÚNG NGHIỆP VỤ
    const handleProceedToCheckout = () => {
        if (!user) {
            // Chưa đăng nhập -> Chuyển sang trang đăng nhập
            alert("Bạn đang ở chế độ khách vãng lai. Vui lòng đăng nhập để tiến hành đặt hàng nhé!")
            navigate("/login")
            return
        }

        // Đã đăng nhập -> Chuyển sang module thanh toán của Người 4
        navigate("/checkout")
    }

    if (loading) {
        return (
            <div className="mx-auto flex min-h-[60vh] max-w-5xl items-center justify-center text-[#735b4e]">
                Đang tải giỏ hàng của bạn...
            </div>
        )
    }

    return (
        <main className="mx-auto max-w-5xl px-5 pb-20 pt-12 sm:px-8">
            <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#725f54] transition hover:text-[#3b241c]">
                <ArrowLeft size={18} /> Tiếp tục chọn món
            </Link>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <h1 className="font-serif text-4xl font-bold text-[#302018]">Giỏ hàng của bạn</h1>
                {!user && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">
                        <LogIn size={14} /> Chế độ khách vãng lai
                    </span>
                )}
            </div>

            {cart.items.length === 0 ? (
                <div className="mt-12 flex flex-col items-center justify-center rounded-3xl bg-[#f7f3ee] p-12 text-center">
                    <ShoppingBag size={56} className="text-[#a89587]" />
                    <p className="mt-4 font-serif text-2xl text-[#3b2a22]">Giỏ hàng của bạn đang trống</p>
                    <p className="mt-2 text-sm text-[#7e6b60]">Hãy chọn cho mình một món đồ uống yêu thích nhé!</p>
                    <Link to="/" className="mt-6 rounded-full bg-[#3b241c] px-7 py-3 text-sm font-bold text-white transition hover:bg-[#523428]">
                        Xem menu ngay
                    </Link>
                </div>
            ) : (
                <div className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
                    {/* DANH SÁCH MÓN */}
                    <div className="space-y-4">
                        {cart.items.map((item) => {
                            const isOut = item.isOutOfStock

                            return (
                                <div
                                    key={item.id}
                                    className={`flex gap-4 rounded-3xl border p-5 transition ${isOut ? "border-red-200 bg-red-50/50 opacity-60" : "border-[#e6ded6] bg-white shadow-sm"
                                        }`}
                                >
                                    <img
                                        src={item.imageUrl || "https://images.unsplash.com/photo-1541167760496-1628856ab772"}
                                        alt={item.productName}
                                        className="size-24 rounded-2xl object-cover"
                                    />

                                    <div className="flex flex-1 flex-col justify-between">
                                        <div>
                                            <div className="flex items-start justify-between">
                                                <h3 className="font-serif text-lg font-bold text-[#302018]">{item.productName}</h3>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(item.id)}
                                                    className="text-[#9e8a7e] hover:text-red-600 transition"
                                                    title="Xóa món"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>

                                            {/* 👉 HIỂN THỊ CHUẨN: SIZE S/M/L, 100% ĐÁ, 100% ĐƯỜNG */}
                                            <p className="mt-1 text-xs text-[#7e6b60]">
                                                Size: <span className="font-semibold text-[#3b2a22]">Size {item.size}</span>
                                                {" · "}
                                                Đá: <span className="font-semibold text-[#3b2a22]">{formatLevel(item.iceLevel)} đá</span>
                                                {" · "}
                                                Ngọt: <span className="font-semibold text-[#3b2a22]">{formatLevel(item.sweetnessLevel)} đường</span>
                                            </p>

                                            {item.toppings?.length > 0 && (
                                                <p className="mt-1 text-xs text-[#7e6b60]">
                                                    Topping: <span className="text-[#3b2a22]">{item.toppings.map((t: any) => t.name).join(", ")}</span>
                                                </p>
                                            )}

                                            {/* BÁO HẾT HÀNG */}
                                            {isOut && (
                                                <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                                                    <AlertCircle size={14} /> Tạm hết hàng (Không thể đặt)
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-4 flex items-center justify-between">
                                            <div>
                                                <p className="font-serif text-lg font-semibold text-[#3b2a22]">
                                                    {formatCurrency(item.totalPrice)}
                                                </p>
                                                {item.quantity > 1 && (
                                                    <p className="text-xs text-[#8d796d]">({formatCurrency(item.unitPrice)} / ly)</p>
                                                )}
                                            </div>

                                            {/* TĂNG / GIẢM SỐ LƯỢNG */}
                                            <div className="flex items-center gap-3 rounded-full border border-[#ddd3c9] bg-white px-3 py-1">
                                                <button
                                                    type="button"
                                                    disabled={isOut || updatingId === item.id}
                                                    onClick={() => handleUpdateQuantity(item.id, item.quantity, -1)}
                                                    className="text-lg text-[#8d796d] hover:text-black disabled:opacity-30"
                                                >
                                                    <Minus size={15} />
                                                </button>
                                                <span className="min-w-4 text-center text-sm font-bold text-[#3b2a22]">{item.quantity}</span>
                                                <button
                                                    type="button"
                                                    disabled={isOut || updatingId === item.id || item.quantity >= item.stockQuantity}
                                                    onClick={() => handleUpdateQuantity(item.id, item.quantity, 1)}
                                                    className="text-lg text-[#3b2a22] hover:text-black disabled:opacity-30"
                                                >
                                                    <Plus size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* TỔNG KẾT ĐƠN HÀNG */}
                    <div className="h-fit rounded-3xl bg-[#f7f3ee] p-6 shadow-sm">
                        <h2 className="font-serif text-xl font-bold text-[#302018]">Tóm tắt đơn hàng</h2>

                        <div className="mt-6 space-y-3 border-b border-[#e5dbd1] pb-5 text-sm text-[#7e6b60]">
                            <div className="flex justify-between">
                                <span>Số lượng món:</span>
                                <span className="font-bold text-[#3b2a22]">{cart.totalItems} phần</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Tạm tính:</span>
                                <span className="font-bold text-[#3b2a22]">{formatCurrency(cart.totalAmount)}</span>
                            </div>
                        </div>

                        <div className="mt-5 flex justify-between font-serif text-xl font-bold text-[#302018]">
                            <span>Tổng thanh toán:</span>
                            <span className="text-2xl text-[#3b241c]">{formatCurrency(cart.totalAmount)}</span>
                        </div>

                        {/* 👉 NÚT THANH TOÁN ĐÃ ĐƯỢC GẮN LOGIC ĐĂNG NHẬP */}
                        <button
                            type="button"
                            disabled={cart.totalItems === 0 || cart.totalAmount === 0}
                            onClick={handleProceedToCheckout}
                            className="mt-6 w-full rounded-full bg-[#3b241c] py-4 text-center text-base font-bold text-white transition hover:bg-[#523428] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {!user ? "Đăng nhập để thanh toán" : "Tiến hành thanh toán"}
                        </button>
                    </div>
                </div>
            )}
        </main>
    )
}