import { useEffect, useRef, useState } from "react";
import { promotionService, PromotionApiError, type CartQuote } from "../services/promotionService";

export const APPLIED_PROMO_KEY = "brewlite_applied_promo";

export interface PromotionCartItem {
  id: string;
  productSizeId: string;
  quantity: number;
  toppingIds?: string[];
  toppings?: { id: string }[];
}

export function useCartPromotion(items: PromotionCartItem[], owner: string) {
  const [appliedPromo, setAppliedPromo] = useState<string | null>(() => localStorage.getItem(APPLIED_PROMO_KEY));
  const [inputError, setInputError] = useState("");
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<{ key: string; quote: CartQuote | null; error: string } | null>(null);
  const key = JSON.stringify({ owner, code: appliedPromo, revision, items: items.map((item) => ({
    id: item.id,
    productSizeId: item.productSizeId,
    quantity: item.quantity,
    toppingIds: [...(item.toppingIds ?? item.toppings?.map((topping) => topping.id) ?? [])].sort(),
  })) });
  const latestKey = useRef(key);
  latestKey.current = key;

  useEffect(() => {
    const controller = new AbortController();
    const request = JSON.parse(key);
    if (!request.items.length) return () => controller.abort();
    const isCurrent = () => !controller.signal.aborted && latestKey.current === key;
    const check = async () => {
      try {
        const quote = await promotionService.quote(request.code, request.items, controller.signal);
        if (!isCurrent()) return;
        if (quote.promotionCode) localStorage.setItem(APPLIED_PROMO_KEY, quote.promotionCode);
        else localStorage.removeItem(APPLIED_PROMO_KEY);
        setResult({ key, quote, error: "" });
      } catch (error) {
        if (!isCurrent()) return;
        const message = error instanceof Error ? error.message : "Không thể kiểm tra khuyến mãi";
        // Mã sai không được giữ tiền giảm; vẫn xin lại giá chưa giảm từ server.
        if (request.code && error instanceof PromotionApiError && [400, 404].includes(error.status)) {
          localStorage.removeItem(APPLIED_PROMO_KEY);
          try {
            const quote = await promotionService.quote(null, request.items, controller.signal);
            if (isCurrent()) setResult({ key, quote, error: message });
            return;
          } catch (pricingError) {
            if (!isCurrent()) return;
            setResult({ key, quote: null, error: pricingError instanceof Error ? pricingError.message : message });
            return;
          }
        }
        setResult({ key, quote: null, error: message });
      }
    };
    void check();
    return () => controller.abort();
  }, [key]);

  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(timer);
    };
  }, []);

  const current = result?.key === key ? result : null;
  const quote = items.length ? current?.quote ?? null : null;
  const error = inputError || (items.length ? current?.error ?? "" : "");
  const pending = items.length > 0 && !current;

  const apply = (code: string) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setInputError("Vui lòng nhập mã ưu đãi.");
      return;
    }
    setInputError("");
    setAppliedPromo(normalized);
    setRevision((value) => value + 1);
  };
  const remove = () => {
    localStorage.removeItem(APPLIED_PROMO_KEY);
    setAppliedPromo(null);
    setInputError("");
    setRevision((value) => value + 1);
  };
  const confirm = async () => {
    const expectedKey = key;
    try {
      const quote = await promotionService.quote(appliedPromo, items);
      if (latestKey.current !== expectedKey) throw new Error("Giỏ hàng đã thay đổi. Vui lòng kiểm tra lại");
      setResult({ key, quote, error: "" });
      if (quote.promotionCode) localStorage.setItem(APPLIED_PROMO_KEY, quote.promotionCode);
      else localStorage.removeItem(APPLIED_PROMO_KEY);
      return quote;
    } catch (error) {
      if (latestKey.current === expectedKey) {
        setResult({ key, quote: null, error: error instanceof Error ? error.message : "Không thể xác nhận giá" });
        localStorage.removeItem(APPLIED_PROMO_KEY);
      }
      throw error;
    }
  };

  return { appliedPromo, quote, error, pending, apply, remove, confirm,
    retry: () => { setInputError(""); setRevision((value) => value + 1); },
    canProceed: items.length > 0 && !pending && !error && Boolean(quote),
  };
}
