import { Check, Copy, Sparkles, TicketPercent } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  Button,
  ButtonLink,
  PageTitle,
  LoadingState,
  ErrorState,
  EmptyState,
  InlineNotice,
} from "../components/ui";
import { promotionService } from "../services/promotionService";
import type { Promotion } from "../types";
import { formatCurrency, formatDate } from "../lib/utils";

export default function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [copyError, setCopyError] = useState(false);
  const [copying, setCopying] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadPromotions() {
      try {
        setLoading(true);
        setError("");
        const data = await promotionService.getPromotions(controller.signal);
        if (!controller.signal.aborted) setPromotions(data);
      } catch (cause) {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : "Không thể tải khuyến mãi",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadPromotions();
    return () => controller.abort();
  }, [reload]);

  useEffect(
    () => () => {
      if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function copyCode(code: string) {
    if (resetTimer.current !== null) clearTimeout(resetTimer.current);
    setCopiedCode(null);
    setNotice("");
    setCopying(true);
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setCopyError(false);
      setNotice("Đã sao chép mã " + code);
      resetTimer.current = setTimeout(() => setCopiedCode(null), 1800);
    } catch {
      setCopyError(true);
      setNotice(
        "Không thể sao chép tự động. Bạn có thể chọn và sao chép mã " +
          code +
          " thủ công.",
      );
    } finally {
      setCopying(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-14 lg:px-8">
      <div className="relative overflow-hidden rounded-[2rem] bg-[#e8dccb] px-6 py-9 sm:px-10 md:px-12 md:py-12">
        <div className="relative z-10 max-w-2xl">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/60 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#65493a]">
            <Sparkles size={14} /> BrewLite treats
          </span>
          <PageTitle
            eyebrow="Ưu đãi dành cho bạn"
            title="Một mã nhỏ, niềm vui to"
            description="Chọn mã hợp với đơn của bạn, sao chép và lưu lại để sử dụng khi đặt hàng."
          />
        </div>
        <TicketPercent
          className="absolute -bottom-10 -right-8 text-white/35"
          size={230}
          strokeWidth={1}
          aria-hidden="true"
        />
      </div>

      <div className="mt-10 flex items-end justify-between gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#806857]">
            Đang áp dụng
          </p>
          <p className="mt-2 font-serif text-3xl text-[#302018] md:text-4xl">
            Mã khuyến mãi hiện có
          </p>
        </div>
        <span className="hidden rounded-full bg-[#e6eee3] px-4 py-2 text-sm font-semibold text-[#49634c] sm:inline-flex">
          {loading
            ? "Đang tải..."
            : error
              ? "Chưa tải được"
              : promotions.length + " ưu đãi"}
        </span>
      </div>

      <div className="mt-5" role="status" aria-live="polite" aria-atomic="true">
        {notice && (
          <InlineNotice type={copyError ? "error" : "success"}>
            {notice}
          </InlineNotice>
        )}
      </div>
      <div className="mt-7 grid gap-5">
        {loading ? (
          <LoadingState label="Đang tải khuyến mãi..." />
        ) : error ? (
          <ErrorState
            description={error}
            action={
              <Button onClick={() => setReload((value) => value + 1)}>
                Thử lại
              </Button>
            }
          />
        ) : promotions.length === 0 ? (
          <EmptyState
            title="Chưa có khuyến mãi"
            description="Hiện chưa có ưu đãi được cung cấp. Bạn hãy quay lại sau nhé."
          />
        ) : (
          promotions.map((promotion) => (
            <article
              key={promotion.code}
              className="group relative flex flex-col overflow-hidden rounded-[1.75rem] border border-[#e1d7cd] bg-white p-6 shadow-[0_12px_40px_rgba(65,42,31,0.06)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_50px_rgba(65,42,31,0.1)] md:grid md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center md:gap-6"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-[#f0e7dd] text-[#604435]">
                <TicketPercent size={23} />
              </span>
              <div>
                <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-[#8a7567] md:mt-0">
                  Giảm{" "}
                  {promotion.discountType === "PERCENTAGE"
                    ? promotion.discountValue + "%"
                    : formatCurrency(promotion.discountValue)}
                </p>
                <p className="mt-2 font-serif text-2xl text-[#302018]">
                  {promotion.title ?? promotion.code}
                </p>
                <p className="mt-2 text-sm leading-6 text-[#756258]">
                  {promotion.description}
                </p>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#79665b]">
                  <p>
                    {promotion.minOrderAmount > 0
                      ? `Đơn tối thiểu ${formatCurrency(promotion.minOrderAmount)}`
                      : "Không yêu cầu giá trị đơn tối thiểu"}
                  </p>
                  {promotion.maxDiscountAmount !== null && (
                    <p>
                      Giảm tối đa {formatCurrency(promotion.maxDiscountAmount)}
                    </p>
                  )}
                  <p>
                    {promotion.appliesToAllProducts
                      ? "Áp dụng toàn bộ menu"
                      : "Áp dụng: " +
                        promotion.products
                          .map((item) => item.product.name)
                          .join(", ")}
                  </p>
                  {promotion.startDate && (
                    <p>Từ {formatDate(promotion.startDate)}</p>
                  )}
                  <p>
                    {promotion.endDate
                      ? "Đến " + formatDate(promotion.endDate)
                      : "Không giới hạn ngày kết thúc"}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2 border-t border-dashed border-[#ded3c9] pt-5 md:mt-0 md:min-w-56 md:border-l md:border-t-0 md:pl-6 md:pt-0">
                <span className="min-w-0 flex-1 select-all break-all font-mono text-base font-bold tracking-wider text-[#3b2a22]">
                  {promotion.code}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={copying}
                  onClick={() => void copyCode(promotion.code)}
                  aria-label={`Sao chép mã ${promotion.code}`}
                >
                  {copiedCode === promotion.code ? (
                    <>
                      <Check size={16} /> Đã chép
                    </>
                  ) : (
                    <>
                      <Copy size={16} /> Sao chép
                    </>
                  )}
                </Button>
              </div>
            </article>
          ))
        )}
      </div>

      <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl bg-[#dfe8dc] p-5 text-center sm:flex-row sm:text-left md:p-6">
        <div>
          <p className="font-serif text-xl text-[#304333]">
            Đã chọn được mã phù hợp?
          </p>
          <p className="mt-1 text-sm text-[#5d715f]">
            Mỗi đơn áp dụng một mã. Bạn có thể dùng lại mã cho những đơn tiếp
            theo khi đủ điều kiện.
          </p>
        </div>
        <ButtonLink to="/#menu">Chọn món ngay</ButtonLink>
      </div>
    </section>
  );
}
