import { useEffect, useState, type FormEvent } from "react";
import { authService, AuthApiError, type RegistrationChallenge } from "../services/authService";
import { Button } from "./ui";

export default function EmailVerificationForm({ challenge, onVerified, onRestart, onResent }: {
  challenge: RegistrationChallenge;
  onVerified: (message: string) => void;
  onRestart: () => void;
  onResent: (challenge: RegistrationChallenge) => void;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(challenge.message);
  const [error, setError] = useState("");
  const [expiresAt, setExpiresAt] = useState(Date.parse(challenge.expiresAt));
  const [resendAt, setResendAt] = useState(() => Date.parse(challenge.expiresAt) - 300000 + challenge.resendAfter * 1000);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const expired = now >= expiresAt;

  function showError(cause: unknown) {
    setError(cause instanceof TypeError ? "Không thể kết nối máy chủ. Vui lòng thử lại." : cause instanceof Error ? cause.message : "Không thể xác minh email.");
    if (cause instanceof AuthApiError && cause.retryAfter) {
      setResendAt(Date.now() + cause.retryAfter * 1000);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await authService.verifyEmail(challenge.registrationId, code);
      onVerified(result.message);
    } catch (cause) { showError(cause); }
    finally { setBusy(false); }
  }

  async function resend() {
    if (busy || wait > 0) return;
    setBusy(true); setError("");
    try {
      const result = await authService.resendVerification(challenge.registrationId);
      onResent(result);
      setExpiresAt(Date.parse(result.expiresAt));
      setResendAt(Date.now() + result.resendAfter * 1000);
      setNow(Date.now()); setCode(""); setMessage(result.message);
    } catch (cause) { showError(cause); }
    finally { setBusy(false); }
  }

  return <div className="mt-7 space-y-4">
    <p className="text-sm leading-6">Nhập mã 6 chữ số đã gửi đến <strong className="break-all">{challenge.email}</strong>. Kiểm tra cả thư rác. Tài khoản chỉ được tạo sau khi xác minh thành công.</p>
    <p role="status" className="text-sm text-[#557058]">{message}</p>
    <form onSubmit={verify} className="space-y-4">
      <label className="block space-y-2 text-sm font-semibold">
        <span>Mã xác minh email</span>
        <input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6}
          autoFocus required disabled={busy || expired} placeholder="000000"
          className="min-h-12 w-full rounded-2xl border border-[#ded4ca] px-4 text-center text-xl tracking-[0.4em]" />
      </label>
      <p className="text-sm text-[#7a685e]">{expired ? "Mã đã hết hạn. Hãy gửi lại mã mới." : `Mã còn hiệu lực ${Math.max(0, Math.ceil((expiresAt - now) / 1000))} giây. Tối đa 5 lần nhập sai.`}</p>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <Button type="submit" fullWidth disabled={busy || expired || code.length !== 6}>{busy ? "Đang xử lý..." : "Xác minh và hoàn tất đăng ký"}</Button>
    </form>
    <button type="button" disabled={busy || wait > 0} onClick={() => void resend()} className="text-sm font-semibold underline disabled:opacity-50">
      {wait > 0 ? `Gửi lại mã sau ${wait} giây` : "Gửi lại mã"}
    </button>
    <button type="button" disabled={busy} onClick={onRestart} className="ml-4 text-sm underline">Đổi email / đăng ký lại</button>
  </div>;
}
