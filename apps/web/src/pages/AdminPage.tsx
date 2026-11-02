import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Navigate, useParams } from "react-router-dom";
import {
  Boxes,
  CircleDollarSign,
  Pencil,
  Plus,
  Search,
  TriangleAlert,
  X,
  RefreshCw,
} from "lucide-react";
import { Button } from "../components/ui";
import {
  adminService,
  type AdminData,
  type AdminProduct,
  type AdminPromotion,
  type AdminSize,
  type Ingredient,
  type AdminCustomer,
  type CustomerOrder,
} from "../services/adminService";

type Section = "ingredients" | "customers" | "products" | "promotions";
type Editable = Ingredient | AdminProduct | AdminPromotion;
const titles = {
  ingredients: [
    "Quản lý nguyên liệu",
    "Theo dõi tồn thực tế, lượng đang giữ và ngưỡng cần nhập thêm theo đơn vị cơ sở.",
  ],
  customers: [
    "Quản lý tài khoản",
    "Tra cứu hồ sơ, điểm thưởng và lịch sử mua hàng của khách hàng.",
  ],
  products: [
    "Quản lý sản phẩm",
    "Cập nhật menu, giá bán và công thức riêng cho từng size S, M, L.",
  ],
  promotions: [
    "Quản lý khuyến mãi",
    "Tạo và cập nhật mã giảm giá, thời gian áp dụng và giới hạn ưu đãi.",
  ],
};
const money = (n: string | number) => `${Number(n).toLocaleString("vi-VN")} đ`;
const amount = (n: string | number) =>
  Number(n).toLocaleString("vi-VN", { maximumFractionDigits: 3 });
const date = (v: string) => new Date(v).toLocaleString("vi-VN");
const inputClass =
  "w-full rounded-xl border border-[#ded3c8] bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#a98f7d]";
const statusNames: Record<string, string> = {
  PENDING_PAYMENT: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
  EXPIRED: "Hết hạn",
};

function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-3xl border border-[#dfd4c9] bg-[#faf7f2] p-5 text-[#35251e] shadow-2xl backdrop:bg-black/45 sm:p-8"
    >
      <div className="mb-6 flex items-start justify-between gap-4">
        <h2 className="font-serif text-2xl">{title}</h2>
        <button
          disabled={busy}
          aria-label="Đóng"
          onClick={onClose}
          className="rounded-full p-2 hover:bg-[#ede4db]"
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Badge({ active }: { active: boolean }) {
  return (
    <span
      className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-[#e4eee1] text-[#456149]" : "bg-[#eee8e2] text-[#7e6b60]"}`}
    >
      {active ? "Đang bật" : "Đã tắt"}
    </span>
  );
}
function Table({
  headers,
  children,
}: {
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="mt-5 overflow-x-auto rounded-2xl border border-[#e2d8ce] bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-[#f1ebe4] text-[#79665b]">
          <tr>
            {headers.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-4 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#eee6df] [&_td]:px-4 [&_td]:py-4">
          {children}
        </tbody>
      </table>
    </div>
  );
}
export default function AdminPage() {
  const { section = "ingredients" } = useParams();
  if (!(section in titles)) return <Navigate to="/admin/ingredients" replace />;
  return <Panel key={section} section={section as Section} />;
}
function Panel({ section }: { section: Section }) {
  const [data, setData] = useState<AdminData | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ item: Editable | null } | null>(null),
    [recipe, setRecipe] = useState<AdminProduct | null>(null),
    [customer, setCustomer] = useState<AdminCustomer | null>(null),
    [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    adminService
      .overview()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [version]);
  const matches = (...values: string[]) =>
    values
      .join(" ")
      .toLocaleLowerCase("vi")
      .includes(query.trim().toLocaleLowerCase("vi"));
  const saved = () => {
    setEditor(null);
    setRecipe(null);
    setMessage("Đã lưu thay đổi.");
    setVersion((n) => n + 1);
  };
  const ingredients =
    data?.ingredients.filter((i) => matches(i.code, i.name)) ?? [];
  const customers =
    data?.customers.filter((c) => matches(c.fullName, c.email)) ?? [];
  const products =
    data?.products.filter((p) => matches(p.name, p.category.name)) ?? [];
  const promotions =
    data?.promotions.filter((p) => matches(p.code, p.title ?? "")) ?? [];
  return (
    <>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">
            {titles[section][0]}
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[#8a7567]">
            {titles[section][1]}
          </p>
        </div>
        {section !== "customers" && (
          <Button
            disabled={!data || loading}
            className="shrink-0"
            onClick={() => setEditor({ item: null })}
          >
            <Plus size={17} />
            {section === "ingredients"
              ? "Thêm nguyên liệu"
              : section === "products"
                ? "Thêm sản phẩm"
                : "Thêm khuyến mãi"}
          </Button>
        )}
      </div>
      {message && (
        <p
          role="status"
          className="mt-5 rounded-xl bg-[#e4eee1] px-4 py-3 text-sm text-[#456149]"
        >
          {message}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}{" "}
          <button
            className="underline"
            onClick={() => setVersion((n) => n + 1)}
          >
            Thử lại
          </button>
        </div>
      )}
      {section === "ingredients" && data && (
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {[
            {
              label: "Nguyên liệu",
              value: `${data.ingredients.length}`,
              detail: "Đang theo dõi",
              icon: Boxes,
            },
            {
              label: "Cần nhập thêm",
              value: `${data.ingredients.filter((i) => i.isActive && Number(i.stock?.onHand ?? 0) - Number(i.stock?.reserved ?? 0) <= Number(i.reorderLevel)).length}`,
              detail: "Theo lượng khả dụng",
              icon: TriangleAlert,
            },
            {
              label: "Giá trị tồn kho",
              value: money(
                data.ingredients.reduce(
                  (sum, i) =>
                    sum + Number(i.stock?.onHand ?? 0) * Number(i.unitCostVnd),
                  0,
                ),
              ),
              detail: "Theo giá vốn",
              icon: CircleDollarSign,
            },
          ].map(({ label, value, detail, icon: Icon }) => (
            <div
              key={label}
              className="rounded-2xl border border-[#e3d9cf] bg-white p-4"
            >
              <div className="flex justify-between gap-2">
                <span className="rounded-xl bg-[#eee7df] p-2.5">
                  <Icon size={19} />
                </span>
                <span className="text-xs text-[#8a786e]">{detail}</span>
              </div>
              <p className="mt-4 text-xs text-[#8a7567]">{label}</p>
              <p className="mt-1 font-serif text-2xl">{value}</p>
            </div>
          ))}
        </div>
      )}
      <div className="mt-7 flex items-center gap-3">
        <label className="relative flex-1">
          <Search
            size={18}
            className="absolute left-4 top-3.5 text-[#9a8677]"
          />
          <input
            aria-label="Tìm kiếm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              section === "customers"
                ? "Tìm tên hoặc email khách hàng..."
                : "Tìm theo tên hoặc mã..."
            }
            className={`${inputClass} pl-11`}
          />
        </label>
        <Button
          variant="secondary"
          disabled={loading}
          aria-label="Tải lại dữ liệu"
          onClick={() => setVersion((n) => n + 1)}
        >
          <RefreshCw size={17} />
        </Button>
      </div>
      {loading ? (
        <p className="py-12 text-center text-[#8a7567]">Đang tải dữ liệu...</p>
      ) : (
        data && (
          <>
            {section === "ingredients" && (
              <>
                <Table
                  headers={[
                    "Nguyên liệu",
                    "Tồn thực tế",
                    "Đang giữ",
                    "Có thể dùng",
                    "Ngưỡng nhập",
                    "Thao tác",
                  ]}
                >
                  {ingredients.map((i) => {
                    const available =
                      Number(i.stock?.onHand ?? 0) -
                      Number(i.stock?.reserved ?? 0);
                    return (
                      <tr key={i.id} className="hover:bg-[#fcfaf7]">
                        <td>
                          <p className="min-w-40 font-semibold">{i.name}</p>
                          <p className="mt-1 text-xs text-[#907d72]">
                            {i.code} · {i.unit}
                          </p>
                          {!i.isActive && <Badge active={false} />}
                        </td>
                        <td>{amount(i.stock?.onHand ?? 0)}</td>
                        <td>{amount(i.stock?.reserved ?? 0)}</td>
                        <td
                          className={
                            available <= Number(i.reorderLevel)
                              ? "font-semibold text-amber-700"
                              : "font-semibold text-[#456149]"
                          }
                        >
                          {amount(available)}
                        </td>
                        <td>{amount(i.reorderLevel)}</td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditor({ item: i })}
                          >
                            <Pencil size={15} />
                            Sửa
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </Table>
                <p className="mt-3 text-xs leading-6 text-[#8a7567]">
                  Có thể dùng = tồn thực tế − đang giữ. Nước lọc và đá không
                  quản lý trong kho.
                </p>
              </>
            )}
            {section === "customers" && (
              <>
                <p className="mt-3 text-xs text-[#8a7567]">
                  Hiển thị tối đa 500 khách hàng mới nhất.
                </p>
                <Table
                  headers={[
                    "Khách hàng",
                    "Điểm khả dụng",
                    "Đang giữ",
                    "Đơn hàng",
                    "Thao tác",
                  ]}
                >
                  {customers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <p className="font-semibold">{c.fullName}</p>
                        <p className="mt-1 text-xs text-[#907d72]">{c.email}</p>
                        <p className="mt-1 text-xs text-[#907d72]">
                          Tham gia{" "}
                          {new Date(c.createdAt).toLocaleDateString("vi-VN")}
                        </p>
                      </td>
                      <td>{amount(c.loyaltyPoints - c.reservedPoints)}</td>
                      <td>{amount(c.reservedPoints)}</td>
                      <td>{c._count.orders}</td>
                      <td>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setCustomer(c)}
                        >
                          Xem đơn
                        </Button>
                      </td>
                    </tr>
                  ))}
                </Table>
              </>
            )}
            {section === "products" && (
              <Table
                headers={["Sản phẩm", "Giá cơ bản", "Trạng thái", "Thao tác"]}
              >
                {products.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="flex min-w-48 items-center gap-3">
                        {p.imageUrl && (
                          <img
                            src={p.imageUrl}
                            alt=""
                            className="size-12 rounded-xl object-cover"
                          />
                        )}
                        <div>
                          <p className="font-semibold">{p.name}</p>
                          <p className="mt-1 text-xs text-[#907d72]">
                            {p.category.name} ·{" "}
                            {
                              p.sizes.filter((s) => s.ingredients.length > 0)
                                .length
                            }
                            /{p.sizes.length} size có công thức
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{money(p.basePrice)}</td>
                    <td>
                      <Badge active={p.isActive} />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditor({ item: p })}
                        >
                          <Pencil size={15} />
                          Sửa
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setRecipe(p)}
                        >
                          Công thức
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
            {section === "promotions" && (
              <Table
                headers={[
                  "Khuyến mãi",
                  "Mức giảm",
                  "Đơn tối thiểu",
                  "Trạng thái",
                  "Thao tác",
                ]}
              >
                {promotions.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <p className="font-semibold">{p.code}</p>
                      <p className="mt-1 min-w-36 text-xs text-[#907d72]">
                        {p.title}
                      </p>
                      <p className="mt-1 text-xs text-[#907d72]">
                        {p.appliesToAllProducts
                          ? "Toàn menu"
                          : "Các món đã chỉ định"}
                      </p>
                    </td>
                    <td className="whitespace-nowrap">
                      {p.discountType === "PERCENTAGE"
                        ? `${p.discountValue}%`
                        : money(p.discountValue)}
                      {p.maxDiscountAmount !== null && (
                        <p className="mt-1 text-xs text-[#907d72]">
                          Tối đa {money(p.maxDiscountAmount)}
                        </p>
                      )}
                    </td>
                    <td>{money(p.minOrderAmount)}</td>
                    <td>
                      <Badge active={p.isActive} />
                      {p.endDate && (
                        <p className="mt-2 text-xs text-[#907d72]">
                          Đến {date(p.endDate)}
                        </p>
                      )}
                    </td>
                    <td>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditor({ item: p })}
                      >
                        <Pencil size={15} />
                        Sửa
                      </Button>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
            {{ ingredients, customers, products, promotions }[section]
              .length === 0 && (
              <p className="py-10 text-center text-[#8a7567]">
                Không có dữ liệu phù hợp.
              </p>
            )}
          </>
        )
      )}
      {editor && data && section !== "customers" && (
        <Editor
          section={section}
          item={editor.item}
          data={data}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
      {recipe && data && (
        <RecipeEditor
          product={recipe}
          ingredients={data.ingredients}
          onClose={() => setRecipe(null)}
          onSaved={saved}
        />
      )}
      {customer && (
        <CustomerOrders customer={customer} onClose={() => setCustomer(null)} />
      )}
    </>
  );
}

type Field = {
  name: string;
  label: string;
  type?: string;
  value?: string | number | boolean | null;
  step?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
};
function Editor({
  section,
  item,
  data,
  onClose,
  onSaved,
}: {
  section: Exclude<Section, "customers">;
  item: Editable | null;
  data: AdminData;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const i = item as Ingredient | null,
    p = item as AdminProduct | null,
    promo = item as AdminPromotion | null;
  const localDate = (v?: string | null) => {
    if (!v) return "";
    const d = new Date(v);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
  };
  const fields: Field[] =
    section === "ingredients"
      ? [
          { name: "code", label: "Mã nguyên liệu", value: i?.code },
          { name: "name", label: "Tên nguyên liệu", value: i?.name },
          {
            name: "unit",
            label: "Đơn vị cơ sở",
            value: i?.unit ?? "g",
            options: ["g", "ml", "pcs"].map((value) => ({
              value,
              label: value,
            })),
          },
          {
            name: "unitCostVnd",
            label: "Giá vốn / đơn vị (đ)",
            type: "number",
            step: "0.0001",
            value: i?.unitCostVnd ?? 0,
          },
          {
            name: "onHand",
            label: "Tồn thực tế",
            type: "number",
            step: "0.001",
            value: i?.stock?.onHand ?? 0,
          },
          {
            name: "reorderLevel",
            label: "Ngưỡng cần nhập thêm",
            type: "number",
            step: "0.001",
            value: i?.reorderLevel ?? 0,
          },
        ]
      : section === "products"
        ? [
            { name: "name", label: "Tên món", value: p?.name },
            {
              name: "categoryId",
              label: "Danh mục",
              value: p?.categoryId ?? data.categories[0]?.id,
              options: data.categories.map((c) => ({
                value: c.id,
                label: c.name,
              })),
            },
            {
              name: "basePrice",
              label: "Giá cơ bản (đ)",
              type: "number",
              value: p?.basePrice ?? 0,
            },
            {
              name: "imageUrl",
              label: "URL ảnh",
              type: "url",
              value: p?.imageUrl,
              required: false,
            },
            {
              name: "description",
              label: "Mô tả",
              type: "textarea",
              value: p?.description,
              required: false,
            },
          ]
        : [
            { name: "code", label: "Mã giảm giá", value: promo?.code },
            { name: "title", label: "Tên khuyến mãi", value: promo?.title },
            {
              name: "discountType",
              label: "Loại giảm",
              value: promo?.discountType ?? "PERCENTAGE",
              options: [
                { value: "PERCENTAGE", label: "Phần trăm" },
                { value: "FIXED", label: "Số tiền (đ)" },
              ],
            },
            {
              name: "discountValue",
              label: "Mức giảm",
              type: "number",
              value: promo?.discountValue ?? 10,
            },
            {
              name: "minOrderAmount",
              label: "Đơn tối thiểu (đ)",
              type: "number",
              value: promo?.minOrderAmount ?? 0,
            },
            {
              name: "maxDiscountAmount",
              label: "Giảm tối đa (đ, trống = không giới hạn)",
              type: "number",
              value: promo?.maxDiscountAmount,
              required: false,
            },
            {
              name: "startDate",
              label: "Bắt đầu",
              type: "datetime-local",
              value: localDate(promo?.startDate),
              required: false,
            },
            {
              name: "endDate",
              label: "Kết thúc",
              type: "datetime-local",
              value: localDate(promo?.endDate),
              required: false,
            },
            {
              name: "description",
              label: "Mô tả",
              type: "textarea",
              value: promo?.description,
              required: false,
            },
          ];
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget),
      body: Record<string, unknown> = {
        isActive: form.get("isActive") === "on",
      };
    for (const field of fields) {
      const value = String(form.get(field.name) ?? "");
      body[field.name] =
        field.type === "number"
          ? value === "" && field.required === false
            ? null
            : Number(value)
          : field.type === "datetime-local"
            ? value
              ? new Date(value).toISOString()
              : null
            : value;
    }
    if (item) {
      body.updatedAt = item.updatedAt;
      if (section === "ingredients")
        body.stockUpdatedAt = i?.stock?.updatedAt ?? null;
    }
    setBusy(true);
    setError("");
    try {
      await adminService.save(section, item?.id ?? null, body);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={`${item ? "Cập nhật" : "Thêm"} ${section === "ingredients" ? "nguyên liệu" : section === "products" ? "sản phẩm" : "khuyến mãi"}`}
      onClose={onClose}
      busy={busy}
    >
      <form onSubmit={submit}>
        {section === "ingredients" && (
          <p className="mb-5 rounded-xl bg-[#eee7df] p-3 text-sm">
            Đang giữ cho đơn hàng:{" "}
            <strong>
              {amount(i?.stock?.reserved ?? 0)} {i?.unit}
            </strong>
            . Nhập tổng tồn thực tế sau kiểm kê; lượng đang giữ được hệ thống
            quản lý.
          </p>
        )}
        {section === "products" && !item && (
          <p className="mb-5 text-sm text-[#856f60]">
            Món mới có ba size S/M/L. Hãy thêm công thức cho từng size trước khi
            bán.
          </p>
        )}
        {section === "promotions" && !item && (
          <p className="mb-5 text-sm text-[#856f60]">
            Mã mới áp dụng cho toàn bộ menu.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <label
              key={f.name}
              className={`block text-sm font-semibold ${f.type === "textarea" ? "sm:col-span-2" : ""}`}
            >
              {f.label}
              <span className="mt-2 block">
                {f.options ? (
                  <select
                    name={f.name}
                    defaultValue={String(f.value ?? "")}
                    className={inputClass}
                  >
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : f.type === "textarea" ? (
                  <textarea
                    name={f.name}
                    defaultValue={String(f.value ?? "")}
                    rows={3}
                    className={inputClass}
                  />
                ) : (
                  <input
                    name={f.name}
                    type={f.type ?? "text"}
                    required={f.required !== false}
                    defaultValue={String(f.value ?? "")}
                    min={f.type === "number" ? 0 : undefined}
                    step={f.step ?? (f.type === "number" ? "1" : undefined)}
                    className={inputClass}
                  />
                )}
              </span>
            </label>
          ))}
        </div>
        <label className="mt-5 flex items-center gap-3 text-sm">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked={item?.isActive ?? true}
            className="size-4 accent-[#456149]"
          />
          Đang hoạt động
        </label>
        {error && (
          <p
            role="alert"
            className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <div className="mt-7 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button disabled={busy}>
            {busy ? "Đang lưu..." : "Lưu thay đổi"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RecipeEditor({
  product,
  ingredients,
  onClose,
  onSaved,
}: {
  product: AdminProduct;
  ingredients: Ingredient[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [sizeId, setSizeId] = useState(product.sizes[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const size = product.sizes.find((s) => s.id === sizeId);
  return (
    <Modal title={`Công thức · ${product.name}`} onClose={onClose} busy={busy}>
      <div className="mb-5 flex gap-2">
        {product.sizes.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={busy}
            onClick={() => setSizeId(s.id)}
            className={`rounded-full px-5 py-2 text-sm font-semibold ${s.id === sizeId ? "bg-[#3b241c] text-white" : "border border-[#dfd4c9] bg-white"}`}
          >
            Size {s.size}
          </button>
        ))}
      </div>
      {size && (
        <RecipeForm
          key={size.id}
          size={size}
          ingredients={ingredients}
          onSaved={onSaved}
          onBusy={setBusy}
        />
      )}
    </Modal>
  );
}
function RecipeForm({
  size,
  ingredients,
  onSaved,
  onBusy,
}: {
  size: AdminSize;
  ingredients: Ingredient[];
  onSaved: () => void;
  onBusy: (value: boolean) => void;
}) {
  const [rows, setRows] = useState(
    size.ingredients.map((r) => ({
      ingredientId: r.ingredientId,
      quantity: String(r.quantity),
      adjustmentGroup: r.adjustmentGroup,
    })),
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  function update(index: number, value: Partial<(typeof rows)[number]>) {
    setRows(rows.map((r, i) => (i === index ? { ...r, ...value } : r)));
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      await adminService.recipe(size.id, {
        updatedAt: size.updatedAt,
        priceAdjustment: Number(form.get("priceAdjustment")),
        cupVolumeMl: Number(form.get("cupVolumeMl")),
        ingredients: rows.map((r) => ({ ...r, quantity: Number(r.quantity) })),
      });
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không lưu được công thức");
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <p className="mb-5 text-sm leading-6 text-[#856f60]">
        Định lượng cho một ly. Chỉ nước đường NL011 thay đổi theo mức đường;
        không thêm nước lọc và đá vào kho. Đơn đã đặt giữ nguyên công thức tại
        thời điểm đặt.
      </p>
      <div className="mb-6 grid grid-cols-2 gap-4">
        <label className="text-sm">
          Dung tích ly (ml)
          <input
            name="cupVolumeMl"
            type="number"
            min="1"
            max="5000"
            required
            defaultValue={size.cupVolumeMl ?? 500}
            className={`mt-2 ${inputClass}`}
          />
        </label>
        <label className="text-sm">
          Giá cộng thêm (đ)
          <input
            name="priceAdjustment"
            type="number"
            min="0"
            required
            defaultValue={size.priceAdjustment}
            className={`mt-2 ${inputClass}`}
          />
        </label>
      </div>
      <div className="space-y-3">
        {rows.map((r, index) => {
          const ingredient = ingredients.find((i) => i.id === r.ingredientId);
          return (
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_6rem_2rem] gap-2 rounded-xl border border-[#dfd4c9] bg-white p-3 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_2rem]"
            >
              <select
                aria-label={`Nguyên liệu ${index + 1}`}
                className={inputClass}
                value={r.ingredientId}
                required
                onChange={(e) =>
                  update(index, {
                    ingredientId: e.target.value,
                    adjustmentGroup: "FIXED",
                  })
                }
              >
                <option value="">Chọn nguyên liệu</option>
                {ingredients
                  .filter((i) => i.isActive || i.id === r.ingredientId)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.code} · {i.name} ({i.unit})
                      {!i.isActive ? " — đã tắt" : ""}
                    </option>
                  ))}
              </select>
              <input
                aria-label={`Định lượng ${index + 1} (${ingredient?.unit ?? ""})`}
                className={inputClass}
                type="number"
                step="0.001"
                min="0.001"
                required
                value={r.quantity}
                onChange={(e) => update(index, { quantity: e.target.value })}
              />
              <select
                aria-label={`Nhóm ${index + 1}`}
                className={`${inputClass} col-span-2 row-start-2 sm:col-span-1 sm:row-auto`}
                value={r.adjustmentGroup}
                onChange={(e) =>
                  update(index, {
                    adjustmentGroup: e.target.value as "FIXED" | "SUGAR",
                  })
                }
              >
                <option value="FIXED">Cố định</option>
                {ingredient?.code === "NL011" && (
                  <option value="SUGAR">Theo đường</option>
                )}
              </select>
              <button
                type="button"
                aria-label={`Xóa nguyên liệu ${index + 1}`}
                className="col-start-3 row-start-1 sm:col-start-4"
                onClick={() => setRows(rows.filter((_, i) => i !== index))}
              >
                <X size={18} />
              </button>
            </div>
          );
        })}
      </div>
      <Button
        className="mt-4"
        type="button"
        variant="secondary"
        onClick={() =>
          setRows([
            ...rows,
            { ingredientId: "", quantity: "1", adjustmentGroup: "FIXED" },
          ])
        }
      >
        <Plus size={16} />
        Thêm thành phần
      </Button>
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <div className="mt-7 flex justify-end">
        <Button disabled={busy || !rows.length}>
          {busy ? "Đang lưu..." : `Lưu công thức size ${size.size}`}
        </Button>
      </div>
    </form>
  );
}
function CustomerOrders({
  customer,
  onClose,
}: {
  customer: AdminCustomer;
  onClose: () => void;
}) {
  const [orders, setOrders] = useState<CustomerOrder[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    adminService
      .orders(customer.id)
      .then((o) => {
        if (active) setOrders(o);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [customer.id]);
  return (
    <Modal title={`Đơn hàng · ${customer.fullName}`} onClose={onClose}>
      <p className="text-sm text-[#856f60]">
        {customer.email} · Tối đa 100 đơn gần nhất
      </p>
      {error && (
        <p role="alert" className="mt-4 text-red-700">
          {error}
        </p>
      )}
      {!orders && !error && <p className="py-8">Đang tải đơn hàng...</p>}
      {orders?.length === 0 && (
        <p className="py-8">Khách hàng chưa có đơn hàng.</p>
      )}
      <div className="mt-5 space-y-3">
        {orders?.map((o) => (
          <div
            key={o.id}
            className="rounded-2xl border border-[#dfd4c9] bg-white p-4"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <strong>{o.orderCode}</strong>
              <span>{statusNames[o.status] ?? o.status}</span>
            </div>
            {o.payments.some(
              (p) =>
                p.status === "SUCCESS" && p.transactionId?.startsWith("DEMO-"),
            ) && (
              <p className="mt-2 text-xs font-semibold text-amber-800">
                Thanh toán mô phỏng · Khách tự xác nhận
              </p>
            )}
            <p className="mt-2 text-xs text-[#907d72]">{date(o.createdAt)}</p>
            <p className="mt-3 text-sm">
              {o.items
                .map((i) => `${i.quantity} × ${i.productName}`)
                .join(", ")}
            </p>
            <p className="mt-3 font-semibold">{money(o.finalAmount)}</p>
          </div>
        ))}
      </div>
    </Modal>
  );
}
