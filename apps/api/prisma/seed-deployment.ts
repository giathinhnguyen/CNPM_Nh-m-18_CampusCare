import 'dotenv/config';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();
try {
  if (process.env.DEPLOY_SEED_EMPTY_DATABASE !== 'true')
    throw new Error('Set DEPLOY_SEED_EMPTY_DATABASE=true only for a new deployment database.');
  const email = process.env.DEPLOY_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEPLOY_ADMIN_PASSWORD;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password || password.length < 16)
    throw new Error('Set DEPLOY_ADMIN_EMAIL and a unique DEPLOY_ADMIN_PASSWORD of at least 16 characters.');
  if (await prisma.product.count() || await prisma.order.count() || await prisma.user.count())
    throw new Error('Database is not empty. Refusing to seed over existing products, accounts or orders.');
  // These catalogs contain the agreed classroom menu and recipes. Only this explicit,
  // empty-database initialization uses their development seed entry points.
  for (const script of ['seed.ts', 'seed-ingredients.ts', 'seed-promotions.ts']) {
    execFileSync(process.execPath, ['--import', 'tsx', `prisma/${script}`], {
      cwd: process.cwd(), stdio: 'inherit', env: { ...process.env, NODE_ENV: 'development' },
    });
  }
  await prisma.user.create({ data: { email, fullName: 'Quản trị BrewLite', role: 'ADMIN', passwordHash: await hash(password, 12) } });
  console.log('Initialized the BrewLite menu, inventory, promotions and deployment administrator.');
} finally { await prisma.$disconnect(); }
