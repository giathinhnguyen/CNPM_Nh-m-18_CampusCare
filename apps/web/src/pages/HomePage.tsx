import { useEffect, useMemo, useState } from "react";
import { ArrowDown, Leaf, Sparkles } from "lucide-react";
import { catalogService } from "../services/catalogService";
import type { Product } from "../types";
import ProductCard from "../components/ProductCard";
import RewardsRedemption from "../components/RewardsRedemption";
import {
  Button,
  EmptyState,
  LoadingState,
  SearchInput,
} from "../components/ui";
import { cx } from "../lib/utils";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Tất cả");
  const [categories, setCategories] = useState<string[]>(["Tất cả"]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCatalog() {
      try {
        setLoading(true);
        setError("");

        const [categoryData, productData] = await Promise.all([
          catalogService.getCategories(),
          catalogService.getProducts(),
        ]);

        if (!active) return;

        setCategories(["Tất cả", ...categoryData.map((item) => item.name)]);
        setProducts(productData);
      } catch (err) {
        if (!active) return;
        setError(
          err instanceof Error ? err.message : "Không thể tải menu BrewLite",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCatalog();
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      products.filter(
        (product) =>
          (category === "Tất cả" || product.category.name === category) &&
          `${product.name} ${product.description ?? ""}`
            .toLowerCase()
            .includes(query.trim().toLowerCase()),
      ),
    [products, category, query],
  );

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-12 pt-5 sm:px-6 md:pb-18 md:pt-8 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] bg-[#dfcfbb] md:rounded-[2.75rem]">
          <div className="grid min-h-[36rem] md:grid-cols-[1.05fr_0.95fr] lg:min-h-[40rem]">
            <div className="relative z-10 flex flex-col justify-center px-6 py-12 sm:px-10 md:px-12 lg:px-16">
              <div className="mb-7 inline-flex w-fit items-center gap-2 rounded-full border border-[#765845]/20 bg-white/50 px-3.5 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#5d4033] backdrop-blur">
                <Sparkles size={14} /> Brew of the season
              </div>
              <h1 className="max-w-xl font-serif text-[3.2rem] font-medium leading-[0.97] tracking-[-0.045em] text-[#2f1e17] sm:text-6xl lg:text-7xl">
                Pha nhẹ một ngày thật hay.
              </h1>
              <p className="mt-6 max-w-lg text-base leading-7 text-[#654d3f] sm:text-lg">
                Cà phê rang mới, trà tuyển chọn và những công thức đầy cảm hứng
                — pha riêng cho nhịp sống của bạn.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button
                  size="lg"
                  onClick={() =>
                    document
                      .getElementById("menu")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Khám phá menu <ArrowDown size={18} />
                </Button>
              </div>
            </div>
            <div className="relative min-h-80 overflow-hidden md:min-h-0">
              <img
                src="https://images.unsplash.com/photo-1749105504681-1889a810be41?auto=format&fit=crop&w=1400&q=90"
                alt="Ly cà phê đá BrewLite trên bàn đá"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#5a3d2e]/20 md:bg-gradient-to-r md:from-[#dfcfbb] md:via-transparent md:to-transparent" />
              <div className="absolute bottom-5 right-5 max-w-52 rounded-2xl border border-white/50 bg-white/80 p-4 shadow-xl backdrop-blur-lg">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#61735d]">
                  <Leaf size={14} /> Nguyên liệu tử tế
                </div>
                <p className="mt-2 text-sm font-semibold leading-5 text-[#3b2a22]">
                  Rang mới mỗi tuần, pha mới cho từng đơn.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="menu"
        className="scroll-mt-24 px-4 py-12 sm:px-6 md:py-18 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#806857]">
                Menu hôm nay
              </p>
              <h2 className="mt-2 font-serif text-4xl tracking-tight text-[#302018] md:text-5xl">
                Một món hợp mood bạn
              </h2>
            </div>
            <div className="w-full md:max-w-sm">
              <SearchInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm cà phê, trà, matcha..."
                aria-label="Tìm kiếm sản phẩm"
              />
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-[9rem_minmax(0,1fr)] lg:grid-cols-[10rem_minmax(0,1fr)]">
            <aside className="md:sticky md:top-24 md:self-start">
              <p className="mb-3 hidden text-xs font-bold uppercase tracking-[0.16em] text-[#8a7567] md:block">
                Danh mục
              </p>
              <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] md:flex-col md:overflow-visible md:pb-0">
                {categories.map((item) => (
                  <button
                    key={item}
                    onClick={() => setCategory(item)}
                    className={cx(
                      "flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#b9845a]/25 md:w-full md:rounded-xl",
                      category === item
                        ? "bg-[#3b241c] text-white"
                        : "border border-[#ddd2c8] bg-white text-[#6c584d] hover:border-[#9c806d]",
                    )}
                  >
                    <span>{item}</span>
                  </button>
                ))}
              </div>
            </aside>

            <div className="min-w-0">
              {loading ? (
                <LoadingState label="Đang chuẩn bị menu hôm nay..." />
              ) : error ? (
                <EmptyState title="Không thể tải menu" description={error} />
              ) : filtered.length > 0 ? (
                <div className="max-h-[calc(100vh-7rem)] overflow-y-auto overscroll-contain pr-2 [scrollbar-color:#bda99b_transparent] [scrollbar-width:thin]">
                  <div className="grid grid-cols-1 gap-5 min-[460px]:grid-cols-2 lg:grid-cols-3 xl:gap-7">
                    {filtered.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState
                  title="Chưa tìm thấy món phù hợp"
                  description="Thử một từ khóa khác hoặc xem toàn bộ menu của BrewLite nhé."
                  action={
                    <Button
                      onClick={() => {
                        setQuery("");
                        setCategory("Tất cả");
                      }}
                    >
                      Xem toàn bộ menu
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] bg-[#dfe8dc]">
          <RewardsRedemption />
        </div>
      </section>
    </>
  );
}
