import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

// All cart, redemption and order mutations take this lock first, across API instances.
export async function lockCustomer(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  const rows = await tx.$queryRaw<
    { id: string }[]
  >`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
  if (!rows.length) throw new NotFoundException('Tài khoản không tồn tại');
}

export async function releaseRedemption(
  tx: Prisma.TransactionClient,
  id: string,
) {
  const redemption = await tx.rewardRedemption.findUniqueOrThrow({
    where: { id },
  });
  if (redemption.status !== 'PENDING') return;
  await tx.user.update({
    where: { id: redemption.userId },
    data: { reservedPoints: { decrement: redemption.totalPointsSpent } },
  });
  await tx.rewardRedemption.update({
    where: { id },
    data: { status: 'CANCELLED' },
  });
}

export function validateObject(
  body: unknown,
  keys: string[],
): Record<string, unknown> {
  if (
    !body ||
    typeof body !== 'object' ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => !keys.includes(key))
  ) {
    throw new BadRequestException('Dữ liệu yêu cầu không hợp lệ');
  }
  return body as Record<string, unknown>;
}
