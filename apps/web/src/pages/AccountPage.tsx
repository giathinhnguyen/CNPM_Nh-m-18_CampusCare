import { LockKeyhole, Mail, Trophy, UserRound } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useState } from "react";
import PasswordSetupForm from "../components/PasswordSetupForm";

export default function AccountPage() {
  const { user, logout, refreshUser } = useAuth();
  const [success, setSuccess] = useState("");
  if (!user) return null;
  return (
    <section className="relative isolate min-h-[calc(100vh-76px)] overflow-hidden px-5 pb-20 pt-12 sm:px-8 sm:pt-14">
      <div className="pointer-events-none absolute -left-12 bottom-12 -z-10 size-40 rounded-full border border-[#eaded3] opacity-70" />
      <div className="pointer-events-none absolute -right-16 top-10 -z-10 size-56 rounded-full border border-[#eaded3] opacity-70" />
      <div className="mx-auto max-w-[400px]">
        <h1 className="font-serif text-3xl tracking-[-0.03em] text-[#302018] sm:text-[2rem]">Tài khoản của tôi</h1>
        <div className="mt-8 rounded-2xl border border-[#eee7df] bg-white p-5 shadow-[0_10px_28px_rgba(68,44,32,0.14)] sm:p-6">
          <div className="space-y-5">
            <div className="flex items-center gap-3 text-sm text-[#3f332d]"><UserRound size={18} strokeWidth={1.5} className="shrink-0 text-[#927b68]" /><span>Họ tên: {user.fullName}</span></div>
            <div className="flex items-center gap-3 text-sm text-[#3f332d]"><Mail size={18} strokeWidth={1.5} className="shrink-0 text-[#927b68]" /><span className="break-all">Email: {user.email}</span></div>
            <div className="flex items-center gap-3 text-sm text-[#3f332d]"><Trophy size={18} strokeWidth={1.5} className="shrink-0 text-[#a28b72]" /><span>Điểm thưởng: {user.loyaltyPoints}</span></div>
            {user.hasPassword ? (
              <div className="flex items-center gap-3 text-sm text-[#3f332d]"><LockKeyhole size={18} strokeWidth={1.5} className="shrink-0 text-[#63908c]" /><span>Tài khoản đã có mật khẩu BrewLite.</span></div>
            ) : !success && (
              <div className="border-t border-[#eee7df] pt-5"><PasswordSetupForm key={user.id} onSuccess={(message) => { setSuccess(message); void refreshUser().catch(() => { /* A reload will refresh the profile after a network failure. */ }); }} /></div>
            )}
            {success && <p role="status" className="rounded-xl bg-[#edf5ed] p-3 text-sm text-[#31583b]">{success}</p>}
          </div>
          <div className="mt-6 flex justify-end"><button type="button" onClick={logout} className="rounded-xl bg-[#3b241c] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(59,36,28,0.18)] transition hover:bg-[#251611]">Đăng xuất</button></div>
        </div>
      </div>
    </section>
  );
}
