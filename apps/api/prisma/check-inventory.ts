import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
try {
  const ingredients = await prisma.ingredient.findMany({
    include: { stock: true },
    orderBy: { code: 'asc' },
  });
  console.table(ingredients.map(({ code, name, unit, stock }) => ({
    'Mã': code,
    'Nguyên liệu': name,
    'Đơn vị': unit,
    'Tồn thực tế': stock?.onHand.toString() ?? 'Chưa nhập kho',
    'Đang giữ': stock?.reserved.toString() ?? '0',
    'Có thể dùng': stock ? stock.onHand.minus(stock.reserved).toString() : '0',
  })));
} finally {
  await prisma.$disconnect();
}
