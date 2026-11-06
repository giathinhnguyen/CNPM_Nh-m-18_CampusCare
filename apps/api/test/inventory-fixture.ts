import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
export async function recipeFixture(
  tx: Prisma.TransactionClient,
  productSizeId: string,
  cups = 10,
) {
  const ingredient = await tx.ingredient.create({
    data: {
      code: randomUUID().replaceAll('-', '').slice(0, 10),
      name: 'Test ingredient',
      unit: 'g',
      unitCostVnd: 2,
      stock: { create: { onHand: cups * 20 } },
    },
  });
  await tx.productIngredient.create({
    data: { productSizeId, ingredientId: ingredient.id, quantity: 20 },
  });
  for (const axis of ['SUGAR', 'ICE'] as const)
    await tx.customizationPolicy.create({
      data: {
        productSizeId,
        axis,
        allowedLevels: [0, 50, 100, 120],
        defaultLevel: 100,
      },
    });
  return ingredient;
}
