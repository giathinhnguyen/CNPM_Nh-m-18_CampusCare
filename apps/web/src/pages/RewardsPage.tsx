import RewardsRedemption from "../components/RewardsRedemption";
import { PageTitle } from "../components/ui";

export default function RewardsPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 md:py-14 lg:px-8">
      <PageTitle
        eyebrow="Đặc quyền thành viên"
        title="Đổi điểm"
        description="Dùng điểm tích lũy để chọn món yêu thích. Mỗi lần đổi một sản phẩm với cấu hình mặc định và giá 0đ."
      />
      <div className="mt-8 overflow-hidden rounded-[2rem] bg-[#dfe8dc]">
        <RewardsRedemption />
      </div>
    </section>
  );
}
