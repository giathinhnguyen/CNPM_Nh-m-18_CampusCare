import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";
import PasswordSetupForm from "../components/PasswordSetupForm";

export default function AccountPage() {
  const { user, logout, refreshUser } = useAuth();
  const [success, setSuccess] = useState("");
  if (!user) return null;
  return (
    <section className="mx-auto max-w-xl space-y-4 px-6 py-12">
      <h1 className="font-serif text-3xl">Tài khoản của tôi</h1>
      <p>Họ tên: {user.fullName}</p>
      <p>Email: {user.email}</p>
      <p>Điểm thưởng: {user.loyaltyPoints}</p>
      {success && <p role="status" className="rounded-xl bg-green-50 p-3 text-green-800">{success}</p>}
      {user.hasPassword ? <p className="text-sm">Tài khoản đã có mật khẩu BrewLite.</p> : !success && <PasswordSetupForm key={user.id} onSuccess={(message) => {
        setSuccess(message);
        void refreshUser().catch(() => { /* A reload will refresh the profile after a network failure. */ });
      }} />}
      <button onClick={logout} className="rounded-xl bg-[#3b241c] px-5 py-3 text-white">Đăng xuất</button>
    </section>
  );
}
