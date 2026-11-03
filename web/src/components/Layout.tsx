import { useEffect, useState } from "react"
import {
  CircleUserRound,
  History,
  LogOut,
  Menu,
  ShoppingBag,
  X,
} from "lucide-react"
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom"
import { getCartCount, getCartSubtotal, formatCurrency } from "../lib/utils"
import { useAppStore } from "../store/useAppStore"
import { Button, ButtonLink, cx, Logo } from "./ui"

const navItems = [
  { label: "Trang chủ", to: "/" },
  { label: "Khuyến mãi", to: "/promotions" },
  { label: "Đơn hàng", to: "/orders" },
]

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const { cart, user, logout, toasts, removeToast } = useAppStore()
  const count = getCartCount(cart)
  const subtotal = getCartSubtotal(cart)

  useEffect(() => {
    setMobileOpen(false)
    setAccountOpen(false)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }, [location.pathname])

  useEffect(() => {
    const timers = toasts.map((toast) =>
      window.setTimeout(() => removeToast(toast.id), 3200),
    )
    return () => timers.forEach(window.clearTimeout)
  }, [toasts, removeToast])

  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#35251e]">
      <header className="sticky top-0 z-40 border-b border-[#e7ded4]/80 bg-[#faf7f2]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav
            className="hidden items-center gap-1 md:flex"
            aria-label="Điều hướng chính"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  cx(
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    isActive && item.to !== "/#menu"
                      ? "bg-[#eee6dc] text-[#39261d]"
                      : "text-[#725f54] hover:bg-[#f1ebe4] hover:text-[#39261d]",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link
              to="/cart"
              className="relative grid size-11 place-items-center rounded-full border border-[#ddd2c8] bg-white text-[#4d352a] transition hover:border-[#a48975] hover:bg-[#f7f1eb]"
              aria-label={`Giỏ hàng có ${count} sản phẩm`}
            >
              <ShoppingBag size={19} />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-[#70906f] px-1 text-[0.65rem] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
            <div className="relative hidden sm:block">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAccountOpen((open) => !open)}
                aria-expanded={accountOpen}
              >
                <CircleUserRound size={18} />
                {user ? user.name.split(" ").slice(-1)[0] : "Đăng nhập"}
              </Button>
              {accountOpen && (
                <div className="absolute right-0 top-12 w-60 rounded-2xl border border-[#e1d7cd] bg-white p-2 shadow-[0_16px_45px_rgba(61,39,29,0.15)]">
                  {user ? (
                    <>
                      <div className="border-b border-[#eee6df] px-3 py-3">
                        <p className="text-sm font-semibold">{user.name}</p>
                        <p className="mt-0.5 truncate text-xs text-[#88756a]">
                          {user.email}
                        </p>
                      </div>
                      <Link
                        className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm hover:bg-[#f5f0ea]"
                        to="/orders"
                      >
                        <History size={17} /> Lịch sử đơn hàng
                      </Link>
                      <button
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-sm text-[#9b3b31] hover:bg-[#fff1ef]"
                        onClick={() => {
                          logout()
                          navigate("/")
                        }}
                      >
                        <LogOut size={17} /> Đăng xuất
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2 p-2">
                      <ButtonLink to="/login" className="w-full">
                        Đăng nhập
                      </ButtonLink>
                      <ButtonLink
                        to="/register"
                        variant="secondary"
                        className="w-full"
                      >
                        Tạo tài khoản
                      </ButtonLink>
                    </div>
                  )}
                </div>
              )}
            </div>
            <button
              className="grid size-11 place-items-center rounded-full text-[#4d352a] hover:bg-[#eee6dc] md:hidden"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label="Mở menu"
            >
              {mobileOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="border-t border-[#e7ded4] bg-[#faf7f2] p-4 md:hidden">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  className="rounded-xl px-4 py-3 text-sm font-semibold hover:bg-[#eee6dc]"
                >
                  {item.label}
                </Link>
              ))}
              <Link
                to={user ? "/orders" : "/login"}
                className="rounded-xl px-4 py-3 text-sm font-semibold hover:bg-[#eee6dc]"
              >
                {user ? `Tài khoản · ${user.name}` : "Đăng nhập"}
              </Link>
            </nav>
          </div>
        )}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mt-20 border-t border-[#ded4ca] bg-[#34231c] text-[#e9ddd3]">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-[1.5fr_1fr_1fr] md:px-8">
          <div>
            <div className="[&_span]:text-white">
              <Logo />
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[#c8b8ac]">
              Đồ uống được pha mới từ nguyên liệu có nguồn gốc rõ ràng, giao đến
              bạn bằng tất cả sự tử tế.
            </p>
          </div>
          <div>
            <p className="font-semibold text-white">Khám phá</p>
            <div className="mt-4 grid gap-3 text-sm text-[#c8b8ac]">
              <Link to="/">Menu hôm nay</Link>
              <Link to="/promotions">Khuyến mãi</Link>
              <Link to="/orders">Đơn hàng của tôi</Link>
              <Link to="/cart">Giỏ hàng</Link>
            </div>
          </div>
          <div>
            <p className="font-semibold text-white">Liên hệ</p>
            <div className="mt-4 space-y-2 text-sm leading-6 text-[#c8b8ac]">
              <p>hello@brewlite.vn</p>
              <p>1900 2025 · 07:00–22:00</p>
              <p>Quận 1, TP. Hồ Chí Minh</p>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-[#a9988d]">
          © 2025 BrewLite. Pha nhẹ một ngày thật hay.
        </div>
      </footer>

      {count > 0 && location.pathname === "/" && (
        <Link
          to="/cart"
          className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-2xl bg-[#3b241c] p-3 pl-4 text-white shadow-[0_16px_40px_rgba(42,25,18,0.3)] md:hidden"
        >
          <span className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-white/15 text-xs font-bold">
              {count}
            </span>
            <span>
              <span className="block text-xs text-white/70">Giỏ hàng</span>
              <span className="font-semibold">{formatCurrency(subtotal)}</span>
            </span>
          </span>
          <span className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-[#3b241c]">
            Xem giỏ
          </span>
        </Link>
      )}

      <div className="fixed right-4 top-20 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <button
            key={toast.id}
            onClick={() => removeToast(toast.id)}
            className={cx(
              "flex items-center gap-3 rounded-2xl border p-4 text-left text-sm font-medium shadow-xl backdrop-blur",
              toast.type === "success" &&
                "border-[#b9d0b9] bg-[#edf5ec]/95 text-[#31583b]",
              toast.type === "error" &&
                "border-[#efc3bd] bg-[#fff2f0]/95 text-[#8c382e]",
              toast.type === "info" &&
                "border-[#ddd2c8] bg-white/95 text-[#49372e]",
            )}
          >
            {toast.message}
          </button>
        ))}
      </div>
    </div>
  )
}
