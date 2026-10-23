import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  Coffee,
  LoaderCircle,
  Search,
  ShoppingBag,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cx } from "../lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export function Button({
  className,
  variant = "primary",
  size = "md",
  fullWidth,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9845a]/25 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" &&
          "bg-[#3b241c] text-white shadow-[0_8px_24px_rgba(59,36,28,0.16)] hover:-translate-y-0.5 hover:bg-[#251611]",
        variant === "secondary" &&
          "border border-[#d9cfc5] bg-white text-[#3b241c] hover:border-[#9d765c] hover:bg-[#f8f3ed]",
        variant === "ghost" &&
          "text-[#5f493e] hover:bg-[#eee6dc] hover:text-[#3b241c]",
        variant === "danger" && "bg-[#a33f35] text-white hover:bg-[#842e26]",
        size === "sm" && "min-h-9 px-4 text-sm",
        size === "md" && "min-h-11 px-5 text-sm",
        size === "lg" && "min-h-13 px-7 text-base",
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  to,
  children,
  variant = "primary",
  className,
}: {
  to: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9845a]/25",
        variant === "primary" &&
          "bg-[#3b241c] text-white shadow-[0_8px_24px_rgba(59,36,28,0.16)] hover:-translate-y-0.5 hover:bg-[#251611]",
        variant === "secondary" &&
          "border border-[#d9cfc5] bg-white text-[#3b241c] hover:border-[#9d765c]",
        variant === "ghost" && "text-[#5f493e] hover:bg-[#eee6dc]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function TextInput({
  icon,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { icon?: ReactNode }) {
  return (
    <label className="relative block">
      {icon && (
        <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-[#8f7a6d]">
          {icon}
        </span>
      )}
      <input
        className={cx(
          "min-h-12 w-full rounded-2xl border border-[#ded4ca] bg-white px-4 text-sm text-[#35241d] outline-none transition placeholder:text-[#9c8c82] focus:border-[#80634e] focus:ring-4 focus:ring-[#b9845a]/15",
          Boolean(icon) && "pl-11",
          className,
        )}
        {...props}
      />
    </label>
  );
}

export function SearchInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <TextInput icon={<Search size={18} />} {...props} />;
}

export function TextArea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full resize-none rounded-2xl border border-[#ded4ca] bg-white px-4 py-3 text-sm leading-5 text-[#35241d] outline-none transition placeholder:text-[#9c8c82] focus:border-[#80634e] focus:ring-4 focus:ring-[#b9845a]/15",
        className,
      )}
      {...props}
    />
  );
}

export function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="max-w-2xl">
      {eyebrow && (
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#7e6657]">
          {eyebrow}
        </p>
      )}
      <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight text-[#302018] md:text-5xl">
        {title}
      </h1>
      {description && (
        <p className="mt-4 leading-7 text-[#725f54]">{description}</p>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-[2rem] border border-[#e5dbd1] bg-white p-8 text-center shadow-[0_16px_50px_rgba(72,46,34,0.07)] md:p-12">
      <span className="mb-5 grid size-16 place-items-center rounded-full bg-[#eee6dc] text-[#5d4033]">
        <ShoppingBag size={28} />
      </span>
      <h2 className="font-serif text-2xl text-[#302018]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#7a685e]">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function LoadingState({
  label = "Đang pha chế dữ liệu...",
}: {
  label?: string;
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-[#735b4e]">
      <LoaderCircle className="animate-spin" size={28} />
      <p className="text-sm font-medium">{label}</p>
    </div>
  );
}

export function ErrorState({
  title = "Có lỗi xảy ra",
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg rounded-[2rem] border border-[#ecc8c2] bg-[#fff6f4] p-8 text-center">
      <AlertCircle className="mx-auto text-[#a33f35]" size={34} />
      <h2 className="mt-4 font-serif text-2xl text-[#562820]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#82584f]">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Logo() {
  return (
    <Link
      to="/"
      className="group inline-flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9845a]/25"
      aria-label="BrewLite - Trang chủ"
    >
      <span className="grid size-9 place-items-center rounded-full bg-[#3b241c] text-[#f6eadb] transition-transform group-hover:-rotate-6">
        <Coffee size={19} strokeWidth={2.2} />
      </span>
      <span className="font-serif text-[1.35rem] font-semibold tracking-tight text-[#302018]">
        BrewLite
      </span>
    </Link>
  );
}

export function InlineNotice({
  children,
  type = "success",
}: {
  children: ReactNode;
  type?: "success" | "error" | "info";
}) {
  return (
    <div
      className={cx(
        "flex items-start gap-2 rounded-xl px-4 py-3 text-sm",
        type === "success" && "bg-[#e8f0e7] text-[#31583b]",
        type === "error" && "bg-[#fff0ed] text-[#8c382e]",
        type === "info" && "bg-[#eee9e3] text-[#5f4b40]",
      )}
    >
      {type === "success" ? (
        <CheckCircle2 className="mt-0.5 shrink-0" size={17} />
      ) : (
        <AlertCircle className="mt-0.5 shrink-0" size={17} />
      )}
      <span>{children}</span>
    </div>
  );
}
