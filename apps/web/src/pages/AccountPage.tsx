import { useAuth } from "../contexts/AuthContext";

export default function AccountPage() {
  const { user, logout } = useAuth();
  if (!user) return null;
  return (
    <section className="mx-auto max-w-xl space-y-4 px-6 py-12">
      <h1 className="font-serif text-3xl">Tài khoản của tôi</h1>
      <p>Họ tên: {user.fullName}</p>
      <p>Email: {user.email}</p>
      <p>Điểm thưởng: {user.loyaltyPoints}</p>
      <button onClick={logout} className="rounded-xl bg-[#3b241c] px-5 py-3 text-white">Đăng xuất</button>
    </section>
  );
}
