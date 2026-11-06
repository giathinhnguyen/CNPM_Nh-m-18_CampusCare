import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();
try {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Chỉ tạo tài khoản thử trên môi trường phát triển');
  const email = 'admin@brewlite.test';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.role !== 'ADMIN')
    throw new Error('Email đã thuộc khách hàng; không tự nâng quyền');
  const user =
    existing ??
    (await prisma.user.create({
      data: {
        email,
        fullName: 'Quản trị BrewLite',
        role: 'ADMIN',
        passwordHash: await hash('BrewLite@Admin2026!', 12),
      },
    }));
  console.log(
    JSON.stringify({ email: user.email, role: user.role, created: !existing }),
  );
} finally {
  await prisma.$disconnect();
}
