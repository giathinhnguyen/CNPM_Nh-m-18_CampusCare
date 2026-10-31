import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

// Explicit development fixture. Re-running never resets an existing balance/password.
const prisma = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Không tạo tài khoản kiểm thử ở production');
  const email = 'rewards500@brewlite.test';
  const passwordHash = await hash('BrewLite@500!', 12);
  const user = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing) return existing;
    return tx.user.create({
      data: {
        email,
        passwordHash,
        fullName: 'Kiểm thử đổi thưởng 500 điểm',
        loyaltyPoints: 500,
        loyaltyTransactions: {
          create: {
            type: 'EARN',
            pointsChange: 500,
            description: 'Điểm ban đầu cho tài khoản kiểm thử đổi thưởng',
          },
        },
      },
    });
  });
  console.log(
    JSON.stringify({
      email: user.email,
      pointsBalance: user.loyaltyPoints,
      reservedPoints: user.reservedPoints,
    }),
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
