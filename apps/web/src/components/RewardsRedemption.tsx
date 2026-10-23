import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Check,
  Gift,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { rewardService } from "../services/rewardService";
import { Button, InlineNotice } from "./ui";
import { cx } from "../lib/utils";

interface RewardProduct {
  id: string;
  pointsRequired: number;
  isActive: boolean;
  productSize: {
    id: string;
    size: "S" | "M" | "L";
    product: {
      id: string;
      name: string;
      imageUrl: string | null;
      stockQuantity: number;
    };
  };
}

type LoadState = "loading" | "success" | "error";

export default function RewardsRedemption() {
  const [products, setProducts] = useState<RewardProduct[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const loadRewards = async () => {
    setLoadState("loading");
    setMessage("");

    try {
      const data = await rewardService.getRewardProducts();
      setProducts(data);
      setLoadState("success");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách đổi thưởng.",
      );
      setLoadState("error");
    }
  };

  useEffect(() => {
    const controller = new AbortController();

    rewardService
      .getRewardProducts(controller.signal)
      .then((data) => {
        if (controller.signal.aborted) return;
        setProducts(data);
        setLoadState("success");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;

        setMessage(
          error instanceof Error
            ? error.message
            : "Không thể tải danh sách đổi thưởng.",
        );
        setLoadState("error");
      });

    return () => controller.abort();
  }, []);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedId) ?? null,
    [products, selectedId],
  );

  return (
    <section className="px-6 py-8 sm:px-10 md:px-12 lg:px-16 lg:py-12">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5d765e]">
            Đặc quyền thành viên
          </p>
          <h3 className="mt-2 font-serif text-3xl text-[#263b2a]">
            Đổi điểm lấy đồ uống
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-[#58705b]">
            Chọn một món đủ điều kiện. Điểm chỉ được trừ sau khi thanh toán
            thành công.
          </p>
        </div>
      </div>

      {loadState === "loading" && (
        <div className="mt-6 flex min-h-48 items-center justify-center gap-3 rounded-2xl bg-white/45 text-sm font-medium text-[#58705b]">
          <LoaderCircle className="animate-spin" size={20} />
          Đang tải sản phẩm đổi thưởng...
        </div>
      )}

      {loadState === "error" && (
        <div className="mt-6 flex min-h-48 flex-col items-center justify-center rounded-2xl border border-[#c7d4c3] bg-white/45 p-6 text-center">
          <AlertCircle className="text-[#6b7f68]" size={27} />
          <p className="mt-3 text-sm font-semibold text-[#354d39]">
            Chưa thể tải sản phẩm đổi thưởng
          </p>
          <p className="mt-1 max-w-md text-xs leading-5 text-[#647667]">
            {message}
          </p>
          <Button
            className="mt-4"
            size="sm"
            variant="secondary"
            onClick={() => void loadRewards()}
          >
            <RefreshCw size={15} /> Thử lại
          </Button>
        </div>
      )}

      {loadState === "success" && products.length === 0 && (
        <div className="mt-6 flex min-h-48 flex-col items-center justify-center rounded-2xl bg-white/45 p-6 text-center">
          <Gift className="text-[#668067]" size={28} />
          <p className="mt-3 font-semibold text-[#354d39]">
            Chưa có món đổi thưởng
          </p>
          <p className="mt-1 text-xs text-[#647667]">
            Các món mới sẽ sớm được cập nhật.
          </p>
        </div>
      )}

      {loadState === "success" && products.length > 0 && (
        <>
          <div className="mt-6 flex snap-x gap-4 overflow-x-auto pb-4 [scrollbar-color:#9db19a_transparent] [scrollbar-width:thin]">
            {products.map((reward) => {
              const product = reward.productSize.product;
              const available = reward.isActive && product.stockQuantity > 0;
              const selected = selectedId === reward.id;

              return (
                <button
                  key={reward.id}
                  type="button"
                  disabled={!available}
                  onClick={() =>
                    setSelectedId((current) =>
                      current === reward.id ? null : reward.id,
                    )
                  }
                  className={cx(
                    "relative w-48 shrink-0 snap-start overflow-hidden rounded-2xl border bg-[#fbf8f3] text-left transition sm:w-52",
                    selected
                      ? "border-[#526f56] ring-4 ring-[#789278]/20"
                      : "border-[#cbd7c7]",
                    available
                      ? "hover:-translate-y-0.5 hover:shadow-lg"
                      : "cursor-not-allowed opacity-70",
                  )}
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="grid aspect-[4/3] place-items-center bg-[#e6e8df]">
                      <Gift size={30} className="text-[#668067]" />
                    </div>
                  )}

                  <div className="p-4">
                    <p className="line-clamp-2 min-h-10 text-sm font-semibold text-[#304533]">
                      {product.name} - Size {reward.productSize.size}
                    </p>
                    <div className="mt-3 flex items-end justify-between gap-2">
                      <span className="text-sm font-bold text-[#49634c]">
                        {reward.pointsRequired.toLocaleString("vi-VN")} điểm
                      </span>
                      <span className="text-[0.65rem] font-bold uppercase tracking-wide text-[#55735a]">
                        {available ? "Có thể chọn" : "Không khả dụng"}
                      </span>
                    </div>
                  </div>

                  {selected && (
                    <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-[#527155] text-white shadow-md">
                      <Check size={15} />
                    </span>
                  )}

                  {!available && (
                    <span className="absolute left-3 top-3 grid size-7 place-items-center rounded-full bg-white/90 text-[#637264]">
                      <LockKeyhole size={14} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-2">
            <InlineNotice type="info">
              Chức năng đổi điểm sẽ được kích hoạt sau khi kết nối tài khoản và
              giỏ hàng với backend.
            </InlineNotice>
          </div>

          <Button className="mt-4" disabled={!selectedProduct || true}>
            <Gift size={17} /> Đổi điểm
          </Button>
        </>
      )}
    </section>
  );
}
