import { useState, type FormEvent } from "react";
import { ArrowRight, Coffee, Eye, EyeOff } from "lucide-react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (loading) {
    return (
      <p className="px-6 py-16 text-center">
        Đang kiểm tra phiên đăng nhập...
      </p>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    setError("");
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? "Không thể kết nối máy chủ. Vui lòng thử lại."
          : cause instanceof Error
            ? cause.message
            : "Đăng nhập thất bại.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass =
    "min-h-12 w-full rounded-2xl border border-[#ded4ca] bg-white px-4 text-sm outline-none focus:border-[#80634e] focus:ring-4 focus:ring-[#b9845a]/15";

  return (
    <section className="px-4 py-8 sm:px-6">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-[#e0d6cc] bg-white shadow-[0_20px_70px_rgba(65,42,31,0.1)] md:grid-cols-[0.9fr_1.1fr]">
        <div className="relative hidden min-h-[38rem] flex-col justify-between overflow-hidden bg-[#3b281f] p-10 text-white md:flex">
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
              Đăng nhập để lưu đơn yêu thích và theo dõi đơn hàng.
            </p>
          </div>
        </div>

        <div className="flex items-center p-6 sm:p-10 md:p-12">
          <div className="w-full">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#806857]">
              Chào bạn
            </p>

            <h1 className="mt-2 font-serif text-4xl text-[#302018]">
              Mừng bạn quay lại
            </h1>

            <p className="mt-3 text-sm leading-6 text-[#7a685e]">
              Đăng nhập để tiếp tục đơn hàng và xem những món bạn yêu thích.
            </p>

            <form className="mt-7 space-y-4" onSubmit={submit}>
              <fieldset disabled={submitting} className="space-y-4">
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

                <label className="block space-y-2 text-sm font-semibold">
                  <span>Mật khẩu</span>
                  <div className="relative">
                    <input
                      name="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      className={`${inputClass} pr-12`}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                      className="absolute inset-y-0 right-3 grid w-9 place-items-center text-[#806e64]"
                    >
                      {showPassword ? (
                        <EyeOff size={17} />
                      ) : (
                        <Eye size={17} />
                      )}
                    </button>
                  </div>
                </label>

                <Button
                  fullWidth
                  size="lg"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
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
            </form>

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