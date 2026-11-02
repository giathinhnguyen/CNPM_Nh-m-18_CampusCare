import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { ingredientCatalog, menuRecipes } from './ingredient-menu.js';
const prisma = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Development inventory seed cannot run in production');
  await prisma.$transaction(
    async (tx) => {
      const ids = new Map<string, string>();
      for (const [code, name, unit, unitCostVnd] of ingredientCatalog) {
        const ingredient = await tx.ingredient.upsert({
          where: { code },
          update: {},
          create: {
            code,
            name,
            unit,
            unitCostVnd,
            reorderLevel: unit === 'g' ? 100 : 500,
          },
        });
        ids.set(code, ingredient.id);
        // Never replenish or reset existing stock/reservations when seeding again.
        await tx.ingredientStock.upsert({
          where: { ingredientId: ingredient.id },
          update: {},
          create: {
            ingredientId: ingredient.id,
            onHand: code === 'NL005' ? 100 : 10000,
          },
        });
      }
      const products = await tx.product.findMany({
        where: { name: { in: Object.keys(menuRecipes) } },
        include: { sizes: true },
      });
      for (const product of products) {
        const recipe = menuRecipes[product.name];
        for (const size of product.sizes) {
          if (
            await tx.productIngredient.count({
              where: { productSizeId: size.id },
            })
          )
            continue;
          const index = ['S', 'M', 'L'].indexOf(size.size);
          for (const [code, quantities] of Object.entries(recipe))
            await tx.productIngredient.create({
              data: {
                productSizeId: size.id,
                ingredientId: ids.get(code)!,
                quantity: quantities[index],
                adjustmentGroup: code === 'NL011' ? 'SUGAR' : 'FIXED',
              },
            });
          await tx.productSize.update({
            where: { id: size.id },
            data: { cupVolumeMl: [350, 500, 700][index] },
          });
          for (const axis of ['SUGAR', 'ICE'] as const)
            await tx.customizationPolicy.upsert({
              where: { productSizeId_axis: { productSizeId: size.id, axis } },
              update: {},
              create: {
                productSizeId: size.id,
                axis,
                allowedLevels:
                  axis === 'ICE' || recipe.NL011 ? [0, 50, 100, 120] : [100],
                defaultLevel: 100,
                policyNote:
                  axis === 'ICE'
                    ? 'Lượng đá là hướng dẫn pha chế, không trừ kho.'
                    : recipe.NL011
                      ? 'Chỉ điều chỉnh nước đường thêm vào; các thành phần ngọt khác giữ nguyên.'
                      : 'Vị ngọt từ sữa đặc, syrup hoặc mật ong thuộc công thức cố định; chưa hỗ trợ đổi mức ngọt.',
              },
            });
        }
      }
      console.log(
        `Seed công thức thử nghiệm cho ${products.length} món; ${ingredientCatalog.length} nguyên liệu, không nước lọc/đá. Không ghi đè công thức/tồn kho đã có.`,
      );
    },
    { timeout: 30000 },
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
