import { FormEvent, useState } from "react"
import { ArrowRight, Coffee, Eye, EyeOff, ShieldCheck } from "lucide-react"
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom"
import { Button, InlineNotice, Logo, TextInput } from "../components/ui"
import { useAppStore } from "../store/useAppStore"

function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="min-h-[calc(100vh-4.5rem)] px-4 py-8 sm:px-6">
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-[#e0d6cc] bg-white shadow-[0_20px_70px_rgba(65,42,31,0.1)] md:grid-cols-[0.9fr_1.1fr]">
        <div className="relative hidden min-h-[38rem] overflow-hidden bg-[#3b281f] p-10 text-white md:flex md:flex-col md:justify-between">
          <img
            src="https://images.unsplash.com/photo-1749104953222-9d6ed76e4bf0?auto=format&fit=crop&w=1000&q=85"
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#2e1c14]/30 to-[#2e1c14]/85" />
          <div className="relative [&_span]:text-white">
            <Logo />
          </div>
          <div className="relative">
            <Coffee size={30} />
            <p className="mt-5 font-serif text-4xl leading-tight">
              Mỗi ngày một ly quen, mỗi lần ghé một niềm vui.
            </p>
            <p className="mt-4 text-sm leading-6 text-white/70">
              Đăng nhập để lưu đơn yêu thích và theo dõi hành trình pha chế.
            </p>
          </div>
        </div>
        <div className="flex items-center p-6 sm:p-10 md:p-12">
          <div className="w-full">
            <div className="mb-8 md:hidden">
              <Logo />
            </div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#806857]">
              Chào bạn
            </p>
            <h1 className="mt-2 font-serif text-4xl text-[#302018]">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-[#7a685e]">{subtitle}</p>
            {children}
          </div>
        </div>
      </div>
    </section>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.36l-3.24-2.54c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.77-5.61-4.14H3.04v2.62A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.92A6.02 6.02 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.61.38 3.14 1.04 4.54l3.35-2.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.94c1.47 0 2.79.5 3.82 1.5l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.94 12 5.94Z"
      />
    </svg>
  )
}

function GoogleAuthButton({
  label,
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <>
      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-[#e5ddd5]" />
        <span className="text-xs font-medium text-[#948278]">hoặc</span>
        <span className="h-px flex-1 bg-[#e5ddd5]" />
      </div>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        fullWidth
        onClick={onClick}
      >
        <GoogleMark />
        {label}
      </Button>
    </>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, login, addToast } = useAppStore()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")

  if (user) return <Navigate to="/" replace />
  const redirect = new URLSearchParams(location.search).get("redirect") || "/"

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get("email") ?? "")
    const password = String(form.get("password") ?? "")
    if (!email.includes("@") || password.length < 6) {
      setError("Vui lòng nhập email hợp lệ và mật khẩu có ít nhất 6 ký tự.")
      return
    }
    const unavailableCount = login(email)
    addToast(
      unavailableCount > 0
        ? `Đã đăng nhập. Có ${unavailableCount} sản phẩm không còn đủ hàng.`
        : "Đăng nhập và gộp giỏ hàng thành công",
      unavailableCount > 0 ? "info" : "success",
    )
    navigate(redirect)
  }

  const continueWithGoogle = () => {
    const unavailableCount = login("google.demo@brewlite.vn", "Khách Google")
    addToast(
      unavailableCount > 0
        ? `Đã đăng nhập bằng Google. Có ${unavailableCount} sản phẩm không còn đủ hàng.`
        : "Đăng nhập bằng Google thành công",
      unavailableCount > 0 ? "info" : "success",
    )
    navigate(redirect)
  }

  return (
    <AuthShell
      title="Mừng bạn quay lại"
      subtitle="Đăng nhập để tiếp tục đơn hàng và xem những món bạn từng yêu thích."
    >
      <form className="mt-7 space-y-4" onSubmit={submit}>
        <label className="block space-y-2 text-sm font-semibold">
          Email
          <TextInput
            name="email"
            type="email"
            placeholder="ban@email.com"
            required
          />
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          Mật khẩu
          <div className="relative">
            <TextInput
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Tối thiểu 6 ký tự"
              required
              minLength={6}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword((show) => !show)}
              className="absolute inset-y-0 right-3 grid w-9 place-items-center text-[#806e64]"
              aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </label>
        {error && <InlineNotice type="error">{error}</InlineNotice>}
        <Button fullWidth size="lg" type="submit">
          Đăng nhập <ArrowRight size={17} />
        </Button>
      </form>
      <GoogleAuthButton
        label="Đăng nhập bằng Google"
        onClick={continueWithGoogle}
      />
      <p className="mt-6 text-center text-sm text-[#7b695f]">
        Chưa có tài khoản?{" "}
        <Link
          to="/register"
          className="font-bold text-[#493127] underline underline-offset-4"
        >
          Đăng ký ngay
        </Link>
      </p>
    </AuthShell>
  )
}

export function RegisterPage() {
  const navigate = useNavigate()
  const { user, login, addToast } = useAppStore()
  const [error, setError] = useState("")
  if (user) return <Navigate to="/" replace />

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "")
    const email = String(form.get("email") ?? "")
    const password = String(form.get("password") ?? "")
    const confirm = String(form.get("confirm") ?? "")
    if (!name.trim() || !email.includes("@") || password.length < 6) {
      setError("Vui lòng điền đầy đủ thông tin hợp lệ.")
      return
    }
    if (password !== confirm) {
      setError("Mật khẩu xác nhận chưa trùng khớp.")
      return
    }
    const unavailableCount = login(email, name)
    addToast("Tạo tài khoản thành công")
    navigate("/")
  }

  const continueWithGoogle = () => {
    const unavailableCount = login("google.demo@brewlite.vn", "Khách Google")
    addToast(
      unavailableCount > 0
        ? `Đã đăng ký bằng Google. Có ${unavailableCount} sản phẩm không còn đủ hàng.`
        : "Đăng ký bằng Google thành công",
      unavailableCount > 0 ? "info" : "success",
    )
    navigate("/")
  }

  return (
    <AuthShell
      title="Gia nhập BrewLite"
      subtitle="Tạo tài khoản để tích điểm dự kiến và theo dõi đơn hàng dễ dàng hơn."
    >
      <form className="mt-7 space-y-4" onSubmit={submit}>
        <label className="block space-y-2 text-sm font-semibold">
          Họ và tên
          <TextInput name="name" placeholder="Nguyễn Minh Anh" required />
        </label>
        <label className="block space-y-2 text-sm font-semibold">
          Email
          <TextInput
            name="email"
            type="email"
            placeholder="ban@email.com"
            required
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm font-semibold">
            Mật khẩu
            <TextInput name="password" type="password" minLength={6} required />
          </label>
          <label className="block space-y-2 text-sm font-semibold">
            Xác nhận mật khẩu
            <TextInput name="confirm" type="password" minLength={6} required />
          </label>
        </div>
        {error && <InlineNotice type="error">{error}</InlineNotice>}
        <div className="flex gap-2 rounded-xl bg-[#edf3eb] p-3 text-xs leading-5 text-[#557058]">
          <ShieldCheck className="mt-0.5 shrink-0" size={17} />
          Thông tin của bạn chỉ được dùng để xử lý đơn hàng mẫu trong phiên này.
        </div>
        <Button fullWidth size="lg" type="submit">
          Tạo tài khoản <ArrowRight size={17} />
        </Button>
      </form>
      <GoogleAuthButton
        label="Đăng ký bằng Google"
        onClick={continueWithGoogle}
      />
      <p className="mt-6 text-center text-sm text-[#7b695f]">
        Đã có tài khoản?{" "}
        <Link
          to="/login"
          className="font-bold text-[#493127] underline underline-offset-4"
        >
          Đăng nhập
        </Link>
      </p>
    </AuthShell>
  )
}
