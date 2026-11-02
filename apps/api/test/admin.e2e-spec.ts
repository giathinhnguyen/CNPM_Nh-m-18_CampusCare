import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { AdminService } from '../src/admin/admin.service.js';
import { AdminGuard } from '../src/admin/admin.guard.js';
import { AuthGuard } from '../src/auth/auth.guard.js';
import { AuthService } from '../src/auth/auth.service.js';
import type { EmailVerificationService } from '../src/auth/email-verification.service.js';
import type { PrismaService } from '../src/prisma/prisma.service.js';

describe('Admin access and inventory management', () => {
  const db = new PrismaClient(),
    prisma = db as PrismaService;
  const admin = new AdminService(prisma);
  const jwt = new JwtService({
    secret: 'admin-test-secret',
    signOptions: { expiresIn: '1h' },
  });
  const auth = new AuthService(prisma, jwt, {} as EmailVerificationService);
  const guard = new AdminGuard(new AuthGuard(jwt, prisma), prisma);
  const users: string[] = [],
    ingredientIds: string[] = [];
  const promotionCode = `QA-${randomUUID()}`.toUpperCase();
  let adminId: string,
    adminEmail: string,
    customerEmail: string,
    categoryId: string;
  const password = 'TestAdminPassword2026!';
  beforeAll(async () => {
    for (const role of ['ADMIN', 'CUSTOMER'] as const) {
      const user = await db.user.create({
        data: {
          email: `${randomUUID()}@admin.invalid`,
          fullName: 'Admin test',
          role,
          passwordHash: await hash(password, 4),
        },
      });
      users.push(user.id);
      if (role === 'ADMIN') {
        adminId = user.id;
        adminEmail = user.email;
      } else customerEmail = user.email;
    }
    categoryId = (
      await db.category.create({
        data: { name: randomUUID(), slug: randomUUID() },
      })
    ).id;
  });
  afterAll(async () => {
    await db.promotion.deleteMany({ where: { code: promotionCode } });
    await db.product.deleteMany({ where: { categoryId } });
    await db.category.delete({ where: { id: categoryId } });
    await db.ingredientStock.deleteMany({
      where: { ingredientId: { in: ingredientIds } },
    });
    await db.ingredient.deleteMany({ where: { id: { in: ingredientIds } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.$disconnect();
  });
  it('validates discount limits and prevents overwriting a newer promotion', async () => {
    const input = { code: promotionCode, title: 'QA promotion', description: '', discountType: 'PERCENTAGE', discountValue: 10, minOrderAmount: 0, maxDiscountAmount: null, isActive: false, startDate: null, endDate: null };
    await expect(admin.promotion(null, { ...input, discountValue: 101 })).rejects.toBeInstanceOf(BadRequestException);
    await admin.promotion(null, input);
    const record = await db.promotion.findUniqueOrThrow({ where: { code: promotionCode } });
    await admin.promotion(record.id, { ...input, updatedAt: record.updatedAt.toISOString(), discountValue: 15 });
    await expect(admin.promotion(record.id, { ...input, updatedAt: record.updatedAt.toISOString() })).rejects.toBeInstanceOf(ConflictException);
    expect((await db.promotion.findUniqueOrThrow({ where: { id: record.id } })).discountValue.toNumber()).toBe(15);
  });
  it('uses one login and derives the role from the account, never the submitted body', async () => {
    expect(
      (await auth.login({ email: adminEmail, password })).user.role,
    ).toBe('ADMIN');
    expect(
      (await auth.login({ email: customerEmail, password, role: 'ADMIN' })).user.role,
    ).toBe('CUSTOMER');
  });
  it('enforces live database role, including after admin is demoted', async () => {
    const run = (token?: string) =>
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { authorization: token && `Bearer ${token}` },
          }),
        }),
      } as ExecutionContext);
    // The request object must be shared between AuthGuard and AdminGuard.
    const request = {
      headers: {
        authorization: `Bearer ${jwt.sign({ sub: adminId, role: 'ADMIN' })}`,
      },
      user: undefined,
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as ExecutionContext;
    await expect(run()).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    await db.user.update({
      where: { id: adminId },
      data: { role: 'CUSTOMER' },
    });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await db.user.update({ where: { id: adminId }, data: { role: 'ADMIN' } });
  });
  it('protects reserved stock and rejects stale stock writes without losing changes', async () => {
    const input = {
      code: `T${randomUUID().slice(0, 8)}`,
      name: 'Admin stock test',
      unit: 'g',
      unitCostVnd: 2,
      reorderLevel: 10,
      onHand: 100,
      isActive: true,
    };
    const created = await admin.ingredient(null, input);
    ingredientIds.push(created.id);
    const before = await db.ingredient.findUniqueOrThrow({
      where: { id: created.id },
      include: { stock: true },
    });
    await db.ingredientStock.update({
      where: { ingredientId: created.id },
      data: { reserved: 20, updatedAt: new Date(Date.now() + 1000) },
    });
    await expect(
      admin.ingredient(created.id, {
        ...input,
        onHand: 50,
        updatedAt: before.updatedAt.toISOString(),
        stockUpdatedAt: before.stock!.updatedAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    const current = await db.ingredientStock.findUniqueOrThrow({
      where: { ingredientId: created.id },
    });
    const update = {
      ...input,
      updatedAt: before.updatedAt.toISOString(),
      stockUpdatedAt: current.updatedAt.toISOString(),
    };
    await expect(
      admin.ingredient(created.id, { ...update, onHand: 19 }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await admin.ingredient(created.id, { ...update, onHand: 50 });
    const after = await db.ingredientStock.findUniqueOrThrow({
      where: { ingredientId: created.id },
    });
    expect(after.onHand.toNumber()).toBe(50);
    expect(after.reserved.toNumber()).toBe(20);
  });
  it('saves size-specific recipes atomically and rejects duplicate/invalid sugar ingredients', async () => {
    const product = await admin.product(null, {
      name: 'Admin recipe test',
      categoryId,
      basePrice: 50000,
      imageUrl: '',
      description: '',
      isActive: true,
    });
    const record = await db.product.findFirstOrThrow({
      where: { categoryId },
      include: { sizes: true },
    });
    expect(product).toBeTruthy();
    const size = record.sizes[0];
    const base = {
      updatedAt: size.updatedAt.toISOString(),
      cupVolumeMl: 350,
      priceAdjustment: 0,
    };
    const row = {
      ingredientId: ingredientIds[0],
      quantity: 10,
      adjustmentGroup: 'FIXED',
    };
    await expect(
      admin.recipe(size.id, { ...base, ingredients: [row, row] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      admin.recipe(size.id, {
        ...base,
        ingredients: [{ ...row, adjustmentGroup: 'SUGAR' }],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await admin.recipe(size.id, { ...base, ingredients: [row] });
    expect(
      await db.productIngredient.count({ where: { productSizeId: size.id } }),
    ).toBe(1);
    expect(
      await db.productIngredient.count({
        where: { productSizeId: record.sizes[1].id },
      }),
    ).toBe(0);
    await expect(
      admin.recipe(size.id, {
        ...base,
        ingredients: [{ ...row, quantity: 30 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
