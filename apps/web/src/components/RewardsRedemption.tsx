import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  Check,
  Gift,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
} from "lucide-react";
import { rewardService, type RewardBalance } from "../services/rewardService";
import { Button, ButtonLink, InlineNotice } from "./ui";
import { cx } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [balance, setBalance] = useState<RewardBalance | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState("");
  const requestKey = useRef<{ productId: string; key: string } | null>(null);
  const submittingRef = useRef(false);
  const [products, setProducts] = useState<RewardProduct[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const loadRewards = () => setReload((value) => value + 1);

  useEffect(() => {
    const controller = new AbortController();

    setBalance(null);
    setSelectedId(null);
    setSuccess("");
    setMessage("");
    setLoadState("loading");
    Promise.all([
      rewardService.getRewardProducts(controller.signal),
      user
        ? rewardService.getBalance(controller.signal)
        : Promise.resolve(null),
    ])
      .then(([data, points]) => {
        if (controller.signal.aborted) return;
        setProducts(data);
        setBalance(points);
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
  }, [user?.id, reload]);

  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    const refresh = () => {
      void rewardService
        .getBalance(controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) setBalance(data);
        })
        .catch(() => {});
    };
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [user?.id]);

  const redeem = async () => {
    if (
      !selectedId ||
      !balance ||
      balance.hasRewardInCart ||
      submittingRef.current
    )
      return;
    submittingRef.current = true;
    const requestedOwner = user?.id;
    setSubmitting(true);
    setMessage("");
    setSuccess("");
    if (requestKey.current?.productId !== selectedId)
      requestKey.current = { productId: selectedId, key: crypto.randomUUID() };
    try {
      const result = await rewardService.redeem(
        selectedId,
        requestKey.current.key,
      );
      if (owner.current !== requestedOwner) return;
      requestKey.current = null;
      setSelectedId(null);
      if (result.cartItem) {
        navigate("/cart");
        return;
      }
      setSuccess(
        "Lượt đổi này đã được xử lý. Vui lòng kiểm tra lại giỏ hàng.",
      );
      const latest = await rewardService.getBalance();
      if (owner.current === requestedOwner) setBalance(latest);
    } catch (error) {
      if (owner.current !== requestedOwner) return;
      setMessage(
        error instanceof Error ? error.message : "Không thể đổi thưởng",
      );
      try {
        const latest = await rewardService.getBalance();
        if (owner.current === requestedOwner) setBalance(latest);
      } catch {
        /* Allow a retry with the same request key. */
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

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
            Điểm được giữ khi thêm món vào giỏ và được giải phóng khi bạn xóa
            món.
          </p>
        </div>
        {balance && (
          <div className="shrink-0 rounded-2xl bg-[#fbf8f3] px-5 py-3 text-right shadow-sm">
            <p className="text-xs text-[#58705b]">Điểm khả dụng</p>
            <p className="font-serif text-2xl text-[#36503a]">
              {balance.availablePoints.toLocaleString("vi-VN")} điểm
            </p>
            <p className="mt-1 text-xs text-[#58705b]">
              Tổng {balance.pointsBalance} · Đang giữ {balance.reservedPoints}
            </p>
          </div>
        )}
      </div>

      {!user && (
        <div className="mt-5">
          <ButtonLink to="/login" variant="secondary">
            Đăng nhập để đổi điểm
          </ButtonLink>
        </div>
      )}
      {balance?.hasRewardInCart && (
        <div className="mt-5">
          <InlineNotice type="info">
            Giỏ hàng đã có sản phẩm đổi thưởng. Hãy xóa món đó trước khi đổi sản
            phẩm khác.
          </InlineNotice>
        </div>
      )}
      <div className="mt-4" role="status" aria-live="polite">
        {success && (
          <>
            <InlineNotice type="success">{success}</InlineNotice>
            <ButtonLink to="/cart" className="mt-3">
              Xem giỏ hàng
            </ButtonLink>
          </>
        )}
        {message && loadState === "success" && (
          <InlineNotice type="error">{message}</InlineNotice>
        )}
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
              const available = Boolean(
                user &&
                balance &&
                !balance.hasRewardInCart &&
                balance.availablePoints >= reward.pointsRequired &&
                reward.isActive &&
                product.stockQuantity > 0 &&
                !submitting,
              );
              const selected = selectedId === reward.id;

              return (
                <button
                  key={reward.id}
                  type="button"
                  disabled={!available}
                  aria-pressed={selected}
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
                        {product.stockQuantity <= 0
                          ? "Hết hàng"
                          : !user
                            ? "Cần đăng nhập"
                            : balance?.hasRewardInCart
                              ? "Đã có trong giỏ"
                              : (balance?.availablePoints ?? 0) <
                                  reward.pointsRequired
                                ? "Chưa đủ điểm"
                                : "Đủ điểm"}
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

          <Button
            className="mt-4"
            onClick={() => void redeem()}
            disabled={
              !selectedProduct ||
              !balance ||
              balance.hasRewardInCart ||
              submitting ||
              balance.availablePoints < selectedProduct.pointsRequired
            }
          >
            {submitting ? (
              <LoaderCircle size={17} className="animate-spin" />
            ) : (
              <Gift size={17} />
            )}{" "}
            {submitting ? "Đang xử lý..." : "Đổi điểm"}
          </Button>
        </>
      )}
    </section>
  );
}
