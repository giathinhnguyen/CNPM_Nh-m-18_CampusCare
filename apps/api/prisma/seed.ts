import 'dotenv/config';
import { PrismaClient, DrinkSize } from '@prisma/client';

const prisma = new PrismaClient();

// Danh mục sản phẩm
const categories = [
  { name: 'Cà phê', slug: 'ca-phe', displayOrder: 1 },
  { name: 'Trà', slug: 'tra', displayOrder: 2 },
  { name: 'Trà sữa', slug: 'tra-sua', displayOrder: 3 },
  { name: 'Đá xay', slug: 'da-xay', displayOrder: 4 },
];

// Các kích thước dùng chung
const sizes = [
  { size: DrinkSize.S, priceAdjustment: 0 },
  { size: DrinkSize.M, priceAdjustment: 8000 },
  { size: DrinkSize.L, priceAdjustment: 14000 },
];

// Dữ liệu sản phẩm lấy từ Figma
const products = [
  {
    name: 'Salted Cloud Coffee',
    category: 'ca-phe',
    description: 'Cà phê đậm vị, kem muối mịn màng',
    price: 49000,
    stock: 18,
    image: '/products/salted-cloud-coffee.webp',
  },
  {
    name: 'Kyoto Matcha Latte',
    category: 'tra',
    description: 'Matcha Nhật Bản, sữa tươi thanh nhẹ',
    price: 55000,
    stock: 9,
    image: '/products/kyoto-matcha-latte.webp',
  },
  {
    name: 'Brown Sugar Boba',
    category: 'tra-sua',
    description: 'Trà sữa ô long, đường nâu và trân châu',
    price: 59000,
    stock: 14,
    image: '/products/brown-sugar-boba.webp',
  },
  {
    name: 'Caramel Cold Brew',
    category: 'ca-phe',
    description: 'Cold brew ủ 16 giờ, caramel cháy',
    price: 52000,
    stock: 11,
    image: '/products/caramel-cold-brew.webp',
  },
  {
    name: 'Strawberry Matcha',
    category: 'tra',
    description: 'Dâu tây tươi, matcha và sữa yến mạch',
    price: 62000,
    stock: 7,
    image: '/products/strawberry-matcha.webp',
  },
  {
    name: 'Cocoa Frost',
    category: 'da-xay',
    description: 'Cacao đậm, đá xay và kem tươi',
    price: 65000,
    stock: 0,
    image: '/products/cocoa-frost.webp',
  },
  {
    name: 'Coconut Latte',
    category: 'ca-phe',
    description: 'Espresso, sữa dừa và kem mịn',
    price: 56000,
    stock: 16,
    image: '/products/coconut-latte.webp',
  },
  {
    name: 'Jasmine Peach Tea',
    category: 'tra',
    description: 'Trà nhài, đào vàng và cam tươi',
    price: 52000,
    stock: 20,
    image: '/products/jasmine-peach-tea.webp',
  },
  {
    name: 'Roasted Oolong Milk Tea',
    category: 'tra-sua',
    description: 'Ô long rang, sữa tươi và mật ong',
    price: 57000,
    stock: 13,
    image: '/products/roasted-oolong-milk-tea.webp',
  },
  {
    name: 'Citrus Espresso Tonic',
    category: 'ca-phe',
    description: 'Espresso, tonic và cam vàng',
    price: 54000,
    stock: 10,
    image: '/products/citrus-espresso-tonic.webp',
  },
  {
    name: 'Mango Yogurt Frost',
    category: 'da-xay',
    description: 'Xoài chín, sữa chua và đá xay',
    price: 64000,
    stock: 8,
    image: '/products/mango-yogurt-frost.webp',
  },
  {
    name: 'Hojicha Cream Cloud',
    category: 'tra-sua',
    description: 'Hojicha rang, sữa tươi và kem cheese',
    price: 61000,
    stock: 12,
    image: '/products/hojicha-cream-cloud.webp',
  },
];

const toppings = [
  { name: 'Trân châu đen', price: 8000 },
  { name: 'Thạch cà phê', price: 9000 },
  { name: 'Kem cheese', price: 12000 },
  { name: 'Pudding trứng', price: 10000 },
  { name: 'Nha đam', price: 8000 },
];

async function main() {
  console.log('Bắt đầu Seed dữ liệu BrewLite...');

  // 1. Tạo hoặc cập nhật danh mục
  const categoryMap = new Map<string, string>();

  for (const category of categories) {
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        displayOrder: category.displayOrder,
        isActive: true,
      },
      create: {
        ...category,
        isActive: true,
      },
    });
    categoryMap.set(category.slug, saved.id);
  }

  // 2. Tạo sản phẩm và kích thước
  for (const product of products) {
    const categoryId = categoryMap.get(product.category)!;

    // Schema hiện tại chưa có slug/unique name cho Product.
    // Tìm theo tên trong phạm vi danh mục để tránh tạo trùng khi Seed lại.
    const existing = await prisma.product.findFirst({
      where: { name: product.name, categoryId },
    });

    const saved = existing
      ? await prisma.product.update({
          where: { id: existing.id },
          data: {
            description: product.description,
            basePrice: product.price,
            stockQuantity: product.stock,
            imageUrl: product.image,
            isActive: true,
          },
        })
      : await prisma.product.create({
          data: {
            name: product.name,
            categoryId,
            description: product.description,
            basePrice: product.price,
            stockQuantity: product.stock,
            imageUrl: product.image,
            isActive: true,
          },
        });

    for (const item of sizes) {
      await prisma.productSize.upsert({
        where: {
          productId_size: {
            productId: saved.id,
            size: item.size,
          },
        },
        update: {
          priceAdjustment: item.priceAdjustment,
          isActive: true,
        },
        create: {
          productId: saved.id,
          size: item.size,
          priceAdjustment: item.priceAdjustment,
          isActive: true,
        },
      });
    }

    console.log(`Đã Seed: ${product.name}`);
  }

  // 3. Tạo topping
  for (const topping of toppings) {
    const existing = await prisma.topping.findFirst({
      where: { name: topping.name },
    });

    if (existing) {
      await prisma.topping.update({
        where: { id: existing.id },
        data: { price: topping.price, isActive: true },
      });
    } else {
      await prisma.topping.create({
        data: { ...topping, isActive: true },
      });
    }
  }

  // 4. Tạo các món đổi điểm từ product size có sẵn.
  // RewardProduct chỉ tham chiếu ProductSize nên không cần tạo sản phẩm riêng.
  const rewardDefinitions = [
    { productName: 'Salted Cloud Coffee', size: DrinkSize.S, pointsRequired: 120 },
    { productName: 'Kyoto Matcha Latte', size: DrinkSize.S, pointsRequired: 140 },
    { productName: 'Brown Sugar Boba', size: DrinkSize.S, pointsRequired: 150 },
  ];

  for (const reward of rewardDefinitions) {
    const productSize = await prisma.productSize.findFirst({
      where: {
        size: reward.size,
        isActive: true,
        product: {
          name: reward.productName,
          isActive: true,
        },
      },
    });

    if (!productSize) continue;

    await prisma.rewardProduct.upsert({
      where: { productSizeId: productSize.id },
      update: {
        pointsRequired: reward.pointsRequired,
        isActive: true,
      },
      create: {
        productSizeId: productSize.id,
        pointsRequired: reward.pointsRequired,
        isActive: true,
      },
    });
  }

  console.log('Seed dữ liệu hoàn tất!');
}

main()
  .catch((error) => {
    console.error('Seed thất bại:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
