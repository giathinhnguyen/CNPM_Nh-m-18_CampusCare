import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, Coffee } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "../components/ui";
import { authService, type RegistrationChallenge } from "../services/authService";
import EmailVerificationForm from "../components/EmailVerificationForm";

const PENDING_KEY = "brewlite_pending_registration";

export default function RegisterPage() {
  const location = useLocation();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<RegistrationChallenge | null>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(PENDING_KEY) || "null");
      return saved && typeof saved.registrationId === "string" && typeof saved.email === "string" && Number.isFinite(Date.parse(saved.expiresAt)) ? saved : null;
    } catch { return null; }
  });
  useEffect(() => {
    if (challenge) sessionStorage.setItem(PENDING_KEY, JSON.stringify(challenge));
    else sessionStorage.removeItem(PENDING_KEY);
  }, [challenge]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    const form = event.currentTarget;
    const data = new FormData(form);

    const input = {
      fullName: String(data.get("fullName") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
      password: String(data.get("password") ?? ""),
      confirmPassword: String(data.get("confirmPassword") ?? ""),
    };

    setError("");
    setSuccess("");

    if (!input.fullName) {
      setError("Vui lòng nhập họ tên.");
      return;
    }

    if (input.password !== input.confirmPassword) {
      setError("Mật khẩu xác nhận chưa trùng khớp.");
      return;
    }

    setLoading(true);

    try {
      const result = await authService.register(input);
      setChallenge(result);
      form.reset();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Không thể đăng ký. Vui lòng thử lại.",
      );
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-2xl border border-[#ded4ca] bg-white px-4 text-sm outline-none focus:border-[#80634e] focus:ring-4 focus:ring-[#b9845a]/15";

  return (
    <section className="px-4 py-8 sm:px-6">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-[#e0d6cc] bg-white shadow-[0_20px_70px_rgba(65,42,31,0.1)] md:grid-cols-[0.9fr_1.1fr]">
        <div className="relative hidden min-h-[38rem] overflow-hidden bg-[#3b281f] p-10 text-white md:flex md:flex-col md:justify-between">
          <img
            src="https://images.unsplash.com/photo-1749104953222-9d6ed76e4bf0?auto=format&fit=crop&w=1000&q=85"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />

          <div className="absolute inset-0 bg-gradient-to-b from-[#2e1c14]/30 to-[#2e1c14]/85" />

          <Link to="/" className="relative font-serif text-3xl">
            BrewLite
          </Link>

          <div className="relative">
            <Coffee size={30} />
            <p className="mt-5 font-serif text-4xl leading-tight">
              Mỗi ngày một ly quen, mỗi lần ghé một niềm vui.
            </p>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Tạo tài khoản để theo dõi đơn hàng và tích điểm thưởng.
            </p>
          </div>
        </div>

        <div className="flex items-center p-6 sm:p-10 md:p-12">
          <div className="w-full">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#806857]">
              Chào bạn
            </p>

            <h1 className="mt-2 font-serif text-4xl text-[#302018]">
              Gia nhập BrewLite
            </h1>

            <p className="mt-3 text-sm leading-6 text-[#7a685e]">
              Tạo tài khoản để tích điểm và theo dõi đơn hàng dễ dàng hơn.
            </p>

            {challenge && <EmailVerificationForm key={challenge.registrationId} challenge={challenge}
              onResent={setChallenge}
              onVerified={(message) => { setChallenge(null); setSuccess(message); setError(""); }}
              onRestart={() => { setChallenge(null); setSuccess(""); setError(""); }} />}
            {success && <p role="status" className="mt-7 rounded-xl bg-[#edf3eb] p-3 text-sm text-[#557058]">{success}</p>}
            {!challenge && !success && <form className="mt-7 space-y-4" onSubmit={submit}>
              <fieldset disabled={loading} className="space-y-4">
                <label className="block space-y-2 text-sm font-semibold">
                  <span>Họ và tên</span>
                  <input
                    name="fullName"
                    autoComplete="name"
                    placeholder="Nguyễn Minh Anh"
                    maxLength={100}
                    required
                    className={inputClass}
                  />
                </label>

                <label className="block space-y-2 text-sm font-semibold">
                  <span>Email</span>
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="ban@email.com"
                    maxLength={255}
                    required
                    className={inputClass}
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2 text-sm font-semibold">
                    <span>Mật khẩu</span>
                    <input
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Ít nhất 8 ký tự"
                      minLength={8}
                      required
                      className={inputClass}
                    />
                  </label>

                  <label className="block space-y-2 text-sm font-semibold">
                    <span>Xác nhận mật khẩu</span>
                    <input
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      placeholder="Nhập lại mật khẩu"
                      minLength={8}
                      required
                      className={inputClass}
                    />
                  </label>
                </div>

                <Button
                  fullWidth
                  size="lg"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? "Đang gửi mã xác minh..." : "Đăng ký và nhận mã xác minh"}
                  <ArrowRight size={17} />
                </Button>
              </fieldset>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </p>
              )}

            </form>}

            <Link to="/login" state={location.state} className="mt-6 block text-center text-sm font-bold text-[#493127] underline underline-offset-4">
              Đăng nhập để tiếp tục
            </Link>
            <Link
              to="/"
              className="mt-6 block text-center text-sm font-bold text-[#493127] underline underline-offset-4"
            >
              Quay lại menu
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
