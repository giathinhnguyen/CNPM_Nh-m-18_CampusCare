import { useRef, useState, type FormEvent } from "react";
import { CreditCard } from "lucide-react";
import { Button } from "./ui";
import { formatCurrency } from "../lib/utils";

export default function DemoCardForm({
  amount,
  disabled,
  onConfirm,
}: {
  amount: number;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState("");
  const samples = {
    demoNumber: "4111 1111 1111 1111",
    demoHolder: "DEMO USER",
    demoExpiry: "12/30",
    demoCode: "123",
  };
  function fill() {
    for (const [key, value] of Object.entries(samples))
      (formRef.current!.elements.namedItem(key) as HTMLInputElement).value =
        value;
    setError("");
  }
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (disabled) return;
    const form = new FormData(e.currentTarget);
    if (
      String(form.get("demoNumber")).replace(/\s/g, "") !==
        "4111111111111111" ||
      String(form.get("demoHolder")).trim().toUpperCase() !== "DEMO USER" ||
      form.get("demoExpiry") !== "12/30" ||
      form.get("demoCode") !== "123"
    ) {
      setError(
        "Chỉ chấp nhận thẻ test. Hãy chọn “Điền dữ liệu test”; không nhập thông tin thẻ thật.",
      );
      return;
    }
    e.currentTarget.reset();
    setError("");
    // Card fields never leave this component: only the order ID is submitted.
    onConfirm();
  }
  const style =
    "mt-2 w-full rounded-xl border border-[#ded3c8] bg-white px-4 py-3 text-sm";
  return (
    <section className="mt-5 rounded-2xl border border-[#ded3c8] bg-[#f7f3ee] p-5">
      <h3 className="flex items-center gap-2 font-serif text-xl">
        <CreditCard size={22} /> Thanh toán thẻ — demo
      </h3>
      <p className="mt-3 text-sm leading-6 text-[#837167]">
        Chỉ nhập thẻ mẫu cho đồ án. Không dùng thẻ thật. Số thẻ và CVV không
        được gửi lên máy chủ hoặc lưu lại.
      </p>
      <form ref={formRef} onSubmit={submit} autoComplete="off" className="mt-4">
        <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold sm:col-span-2">
            Số thẻ test
            <input
              name="demoNumber"
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={23}
              placeholder="4111 1111 1111 1111"
              className={style}
            />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Tên chủ thẻ test
            <input
              name="demoHolder"
              autoComplete="off"
              required
              maxLength={40}
              placeholder="DEMO USER"
              className={style}
            />
          </label>
          <label className="text-sm font-semibold">
            Ngày hết hạn
            <input
              name="demoExpiry"
              autoComplete="off"
              required
              maxLength={5}
              placeholder="12/30"
              className={style}
            />
          </label>
          <label className="text-sm font-semibold">
            CVV test
            <input
              name="demoCode"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={3}
              placeholder="123"
              className={style}
            />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <Button
          type="button"
          disabled={disabled}
          variant="secondary"
          className="mt-4"
          onClick={fill}
        >
          Điền dữ liệu test
        </Button>
        <Button type="submit" disabled={disabled} fullWidth className="mt-3">
          Thanh toán mô phỏng {formatCurrency(amount)}
        </Button>
      </form>
    </section>
  );
}
