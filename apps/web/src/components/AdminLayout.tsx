import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Boxes,
  Coffee,
  Users,
  TicketPercent,
  ShieldCheck,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useAuth } from '../contexts/AuthContext';

const sections = [
  {
    id: "ingredients",
    label: "Nguyên liệu",
    detail: "Tồn kho & định lượng",
    icon: Boxes,
  },
  {
    id: "customers",
    label: "Khách hàng",
    detail: "Tài khoản & điểm",
    icon: Users,
  },
  {
    id: "products",
    label: "Sản phẩm",
    detail: "Menu & công thức",
    icon: Coffee,
  },
  {
    id: "promotions",
    label: "Khuyến mãi",
    detail: "Mã giảm giá",
    icon: TicketPercent,
  },
];
export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  if (loading)
    return <p className="p-12 text-center">Đang kiểm tra quyền quản trị...</p>;
  if (!user)
    return <Navigate to="/login" replace />;
  if (user.role !== 'ADMIN') return <Navigate to="/" replace />;
  return (
    <div className="min-h-screen bg-[#faf7f2] text-[#35251e]">
      <div className="mx-auto max-w-7xl px-4 py-7 sm:px-6 md:py-10 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-5 rounded-[2rem] bg-[#34231c] p-7 text-white sm:flex-row sm:items-center md:px-9">
          <div>
            <p className="flex items-center gap-2 text-sm text-[#cbb9ab]">
              <ShieldCheck size={18} /> BrewLite Admin
            </p>
            <p className="mt-2 font-serif text-3xl">Trung tâm vận hành</p>
            <p className="mt-2 text-sm text-[#cbb9ab]">
              Quản lý cửa hàng từ nguyên liệu đến ưu đãi.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm">{user.fullName}</span>
            <button
              className="flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-sm hover:bg-white/10"
              onClick={() => {
                logout();
                navigate("/login", { replace: true });
              }}
            >
              <LogOut size={16} />
              Đăng xuất
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
            <nav
              aria-label="Quản trị"
              className="flex gap-2 overflow-x-auto pb-2 lg:flex-col"
            >
              {sections.map(({ id, label, detail, icon: Icon }) => (
                <NavLink
                  key={id}
                  to={`/admin/${id}`}
                  className={({ isActive }) =>
                    `flex min-w-48 items-center gap-3 rounded-2xl border px-4 py-3 transition ${isActive ? "border-[#3b241c] bg-[#3b241c] text-white shadow-lg" : "border-[#e0d6cc] bg-white text-[#59463b] hover:border-[#a98f7d]"}`
                  }
                >
                  <Icon size={20} />
                  <span className="flex-1">
                    <span className="block text-sm font-bold">{label}</span>
                    <span className="mt-1 block text-xs opacity-65">
                      {detail}
                    </span>
                  </span>
                  <ChevronRight size={16} />
                </NavLink>
              ))}
            </nav>
          </aside>
          <main className="min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
