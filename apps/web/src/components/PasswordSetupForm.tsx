import { useEffect, useState, type FormEvent } from "react";
import { authService, AuthApiError, type PasswordSetupChallenge } from "../services/authService";
import { Button } from "./ui";

export default function PasswordSetupForm({ onSuccess }: { onSuccess: (message: string) => void }) {
  const [challenge, setChallenge] = useState<PasswordSetupChallenge | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const expired = !!challenge && now >= Date.parse(challenge.expiresAt);
  function handleError(cause: unknown) {
    setError(cause instanceof TypeError ? "Không thể kết nối máy chủ. Vui lòng thử lại." : cause instanceof Error ? cause.message : "Không thể đặt mật khẩu.");
    if (cause instanceof AuthApiError && cause.retryAfter) setResendAt(Date.now() + cause.retryAfter * 1000);
  }
  async function requestCode() {
    if (busy || wait > 0) return;
    setBusy(true); setError("");
    try {
      const result = await authService.requestPasswordSetup();
      setChallenge(result); setNow(Date.now());
      setResendAt(Date.now() + result.resendAfter * 1000);
    } catch (cause) { handleError(cause); }
    finally { setBusy(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !challenge) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    const code = String(data.get("code") || "");
    const password = String(data.get("password") || "");
    const confirm = String(data.get("confirmPassword") || "");
    setError("");
    if (password !== confirm) { setError("Mật khẩu xác nhận chưa trùng khớp."); return; }
    if (new TextEncoder().encode(password).length > 72) { setError("Mật khẩu không được vượt quá 72 byte UTF-8."); return; }
    setBusy(true);
    try {
      const result = await authService.confirmPasswordSetup(challenge.challengeId, code, password, confirm);
      form.reset(); onSuccess(result.message);
    } catch (cause) { handleError(cause); }
    finally { setBusy(false); }
  }
  const inputClass = "min-h-12 w-full rounded-xl border border-[#ded4ca] bg-white px-4";
  return <section className="space-y-4 rounded-2xl border border-[#ded4ca] bg-[#f5efe8] p-5">
    <h2 className="text-xl font-semibold">Đặt mật khẩu BrewLite</h2>
    <p className="text-sm leading-6">Tài khoản của bạn hiện đăng nhập bằng Google. Đặt thêm mật khẩu BrewLite để dùng cả hai cách với cùng tài khoản. Không nhập mật khẩu Google ở đây.</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {challenge && <>
      <p role="status" className="text-sm">Mã 6 số đã gửi đến <strong className="break-all">{challenge.email}</strong>. Mã có hiệu lực 5 phút, tối đa 5 lần nhập sai.</p>
      {expired && <p className="text-sm text-red-700">Mã đã hết hạn. Hãy gửi lại mã mới.</p>}
      <form onSubmit={submit} className="space-y-4">
        <fieldset disabled={busy || expired} className="space-y-4">
          <label className="block space-y-2"><span>Mã xác minh email</span><input key={challenge.challengeId} name="code" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required className={inputClass} /></label>
          <label className="block space-y-2"><span>Mật khẩu BrewLite mới</span><input name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClass} /></label>
          <label className="block space-y-2"><span>Xác nhận mật khẩu</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required className={inputClass} /></label>
          <Button type="submit" disabled={busy || expired}>{busy ? "Đang xử lý..." : "Xác minh và đặt mật khẩu"}</Button>
        </fieldset>
      </form>
    </>}
    <button type="button" onClick={() => void requestCode()} disabled={busy || wait > 0} className="text-sm font-semibold underline disabled:opacity-50">
      {busy ? "Đang xử lý..." : wait > 0 ? `Gửi lại mã sau ${wait} giây` : challenge ? "Gửi lại mã" : "Gửi mã xác minh để đặt mật khẩu"}
    </button>
  </section>;
}
