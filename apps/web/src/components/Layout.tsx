import { useEffect, useRef, useState } from "react";
import {
  CircleUserRound,
  Coffee,
  Menu,
  ShoppingBag,
  X,
  ChevronDown,
  ArrowRight,
  MapPin,
  Mail,
  Clock3,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { cx } from "../lib/utils";

const navItems = [
  { label: "Trang chủ", to: "/" },
  { label: "Khuyến mãi", to: "/promotions" },
  { label: "Đơn hàng", to: "/orders" },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    const closeMenus = () => {
      setMobileOpen(false);
      setAccountOpen(false);
    };

    const handleOutsideClick = (event: MouseEvent) => {
      if (
        accountRef.current &&
        !accountRef.current.contains(event.target as Node)
      ) {
        setAccountOpen(false);
      }
    };

    closeMenus();
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col bg-[#faf7f2] font-sans text-[#35251e]">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-[#e7ded4]/80 bg-[#faf7f2]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* LOGO */}
          <Link
            to="/"
            className="group flex shrink-0 items-center gap-2.5"
            aria-label="BrewLite - Trang chủ"
          >
            <span className="flex size-11 items-center justify-center rounded-2xl bg-[#3b241c] text-[#f5e7d5] transition-transform group-hover:-rotate-6">
              <Coffee size={23} strokeWidth={1.8} />
            </span>

            <span className="font-serif text-[1.9rem] leading-none tracking-[-0.045em] text-[#34231c]">
              Brew<span className="text-[#a47b5e]">Lite</span>
            </span>
          </Link>

          {/* DESKTOP NAVIGATION */}
          <nav
            className="hidden items-center gap-1 rounded-full border border-[#e8ded4] bg-[#f5efe8]/75 p-1 md:flex"
            aria-label="Điều hướng chính"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cx(
                    "rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200",
                    isActive
                      ? "bg-[#3b241c] text-white shadow-sm"
                      : "text-[#735d50] hover:bg-white hover:text-[#3b241c]",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* HEADER ACTIONS */}
          <div className="flex items-center gap-2">
            <Link
              to="/cart"
              aria-label="Xem giỏ hàng"
              className="relative grid size-11 place-items-center rounded-full border border-[#e3d8cd] bg-white text-[#493227] transition hover:border-[#aa8b75] hover:bg-[#f5eee7]"
            >
              <ShoppingBag size={19} strokeWidth={1.8} />
            </Link>

            {/* ACCOUNT DROPDOWN */}
            <div ref={accountRef} className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                aria-expanded={accountOpen}
                aria-haspopup="menu"
                className="flex h-11 items-center gap-2 rounded-full border border-[#e3d8cd] bg-white px-4 text-sm font-semibold text-[#493227] transition hover:border-[#aa8b75] hover:bg-[#f5eee7]"
              >
                <CircleUserRound size={19} strokeWidth={1.8} />
                <span>Đăng nhập</span>
                <ChevronDown
                  size={15}
                  className={cx(
                    "transition-transform",
                    accountOpen && "rotate-180",
                  )}
                />
              </button>

              {accountOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-[calc(100%+12px)] z-50 w-60 rounded-2xl border border-[#e4d9cf] bg-white p-2 shadow-[0_18px_48px_rgba(61,39,29,0.14)]"
                >
                  <p className="px-3 pb-3 pt-2 text-xs leading-5 text-[#8b776b]">
                    Đăng nhập để quản lý đơn hàng và tích điểm thưởng.
                  </p>

                  <Link
                    role="menuitem"
                    to="/login"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center justify-between rounded-xl bg-[#3b241c] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#56372a]"
                  >
                    Đăng nhập
                    <ArrowRight size={16} />
                  </Link>

                  <Link
                    role="menuitem"
                    to="/register"
                    onClick={() => setAccountOpen(false)}
                    className="mt-2 flex items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold text-[#4b3529] transition hover:bg-[#f5f0ea]"
                  >
                    Tạo tài khoản
                  </Link>
                </div>
              )}
            </div>

            {/* MOBILE MENU BUTTON */}
            <button
              type="button"
              onClick={() => setMobileOpen((open) => !open)}
              aria-label={mobileOpen ? "Đóng menu" : "Mở menu"}
              aria-expanded={mobileOpen}
              className="grid size-11 place-items-center rounded-full border border-[#e3d8cd] bg-white text-[#493227] transition hover:bg-[#f1e8df] md:hidden"
            >
              {mobileOpen ? <X size={21} /> : <Menu size={21} />}
            </button>
          </div>
        </div>

        {/* MOBILE NAVIGATION */}
        {mobileOpen && (
          <div className="border-t border-[#e7ded4] bg-[#faf7f2] px-4 py-4 shadow-lg md:hidden">
            <nav className="mx-auto flex max-w-7xl flex-col gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cx(
                      "rounded-xl px-4 py-3 text-sm font-semibold transition",
                      isActive
                        ? "bg-[#3b241c] text-white"
                        : "text-[#624c3e] hover:bg-[#eee6dc]",
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}

              <div className="my-2 border-t border-[#e7ded4]" />

              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-[#624c3e] hover:bg-[#eee6dc]"
              >
                Đăng nhập
              </Link>

              <Link
                to="/register"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl px-4 py-3 text-sm font-semibold text-[#624c3e] hover:bg-[#eee6dc]"
              >
                Tạo tài khoản
              </Link>
            </nav>
          </div>
        )}
      </header>

      {/* PAGE CONTENT */}
      <main className="w-full flex-1">
        <Outlet />
      </main>

      {/* FOOTER */}
      <footer className="mt-16 bg-[#34231c] text-[#e9ddd3]">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-14 md:grid-cols-[1.5fr_1fr_1fr] md:px-8">
          {/* BRAND */}
          <div>
            <Link to="/" className="inline-flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl bg-[#f1e5d8] text-[#3b241c]">
                <Coffee size={22} />
              </span>

              <span className="font-serif text-3xl tracking-tight text-white">
                Brew<span className="text-[#d4ae8d]">Lite</span>
              </span>
            </Link>

            <p className="mt-5 max-w-sm text-sm leading-7 text-[#c8b8ac]">
              Đồ uống được pha mới từ nguyên liệu có nguồn gốc rõ ràng, giao đến
              bạn bằng tất cả sự tử tế.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-[#d9c8ba]">
              <Coffee size={14} />
              Pha nhẹ một ngày thật hay.
            </div>
          </div>

          {/* LINKS */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-white">
              Khám phá
            </h3>

            <div className="mt-5 flex flex-col gap-3.5 text-sm text-[#c8b8ac]">
              <Link to="/" className="transition hover:text-white">
                Menu hôm nay
              </Link>
              <Link to="/promotions" className="transition hover:text-white">
                Khuyến mãi
              </Link>
              <Link to="/orders" className="transition hover:text-white">
                Đơn hàng của tôi
              </Link>
              <Link to="/cart" className="transition hover:text-white">
                Giỏ hàng
              </Link>
            </div>
          </div>

          {/* CONTACT */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-white">
              Liên hệ
            </h3>

            <div className="mt-5 space-y-4 text-sm text-[#c8b8ac]">
              <div className="flex items-start gap-3">
                <Mail size={17} className="mt-0.5 shrink-0" />
                <span>hello@brewlite.vn</span>
              </div>

              <div className="flex items-start gap-3">
                <Clock3 size={17} className="mt-0.5 shrink-0" />
                <span>07:00 – 22:00</span>
              </div>

              <div className="flex items-start gap-3">
                <MapPin size={17} className="mt-0.5 shrink-0" />
                <span>Quận 1, TP. Hồ Chí Minh</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 px-5 py-5 text-center text-xs text-[#a9988d]">
          © {new Date().getFullYear()} BrewLite. Pha nhẹ một ngày thật hay.
        </div>
      </footer>
    </div>
  );
}
