import 'dotenv/config';
import { DiscountType, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const promotions = [
  {
    code: 'BREW10',
    title: 'Nhẹ ví cho mọi mood',
    description: 'Giảm 10% cho toàn bộ thức uống trong menu.',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 10,
    maxDiscountAmount: 50000,
    minOrderAmount: 0,
    displayOrder: 1,
  },
  {
    code: 'PICKUP15',
    title: 'Đặt trước, ghé lấy liền',
    description: 'Ưu đãi riêng cho đơn nhận tại quán từ 150.000đ.',
    discountType: DiscountType.PERCENTAGE,
    discountValue: 15,
    maxDiscountAmount: 40000,
    minOrderAmount: 150000,
    displayOrder: 2,
  },
  {
    code: 'MOOD20K',
    title: 'Thêm món, thêm vui',
    description: 'Giảm ngay 20.000đ khi hóa đơn đạt từ 120.000đ.',
    discountType: DiscountType.FIXED,
    discountValue: 20000,
    maxDiscountAmount: null,
    minOrderAmount: 120000,
    displayOrder: 3,
  },
];

async function main() {
  // Chỉ tạo/cập nhật ba mã mẫu, không thay đổi sản phẩm hay tồn kho.
  for (const promotion of promotions) {
    const data = {
      ...promotion,
      appliesToAllProducts: true,
      isActive: true,
      startDate: null,
      endDate: null,
    };
    await prisma.promotion.upsert({
      where: { code: promotion.code },
      update: data,
      create: data,
    });
    console.log(`Đã seed khuyến mãi: ${promotion.code}`);
  }
}

main()
  .catch((error) => {
    console.error('Seed khuyến mãi thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
