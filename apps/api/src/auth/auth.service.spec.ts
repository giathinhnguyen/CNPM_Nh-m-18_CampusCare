import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { describe, it, expect, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

const id = '12345678-1234-4234-8234-123456789abc';
const input = { fullName: ' Khách hàng ', email: ' TEST@example.com ', password: 'password123', confirmPassword: 'password123' };

function fixture() {
  let saved: Record<string, unknown> | null = null;
  const user = {
    findFirst: vi.fn(async () => saved),
    findUnique: vi.fn(async () => saved),
    create: vi.fn(async ({ data, select }: { data: Record<string, unknown>; select?: unknown }) => {
      saved = { id, role: 'CUSTOMER', loyaltyPoints: 0, ...data };
      return select ? { id, fullName: data.fullName, email: data.email } : saved;
    }),
  };
  const jwt = new JwtService({ secret: 'integration-test-secret', signOptions: { expiresIn: '1h' } });
  const service = new AuthService({ user } as unknown as PrismaService, jwt);
  return { service, user, jwt, saved: () => saved };
}

describe('Integrated email registration and login', () => {
  it('registers a bcrypt account, logs in with the same password, and retrieves its profile', async () => {
    const f = fixture();
    const registered = await f.service.register(input);
    expect(registered.user.email).toBe('test@example.com');
    expect(registered.user.fullName).toBe('Khách hàng');
    expect(registered.user).not.toHaveProperty('passwordHash');
    const passwordHash = f.saved()?.passwordHash as string;
    expect(passwordHash).not.toBe(input.password);
    expect(await compare(input.password, passwordHash)).toBe(true);
    const loggedIn = await f.service.login({ email: input.email, password: input.password });
    expect(loggedIn.user.id).toBe(id);
    expect(loggedIn.user).not.toHaveProperty('passwordHash');
    expect(f.jwt.verify(loggedIn.accessToken).sub).toBe(id);
    expect((await f.service.getCurrentUser(id)).id).toBe(id);
    await expect(f.service.register(input)).rejects.toBeInstanceOf(ConflictException);
    await expect(f.service.login({ email: input.email, password: 'incorrect' })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it.each([
    { ...input, email: 'invalid-email' },
    { ...input, fullName: ' ' },
    { ...input, password: 'short' },
    { ...input, confirmPassword: 'different' },
    { ...input, password: 'á'.repeat(40), confirmPassword: 'á'.repeat(40) },
  ])('rejects invalid registration without saving an account', async (data) => {
    const f = fixture();
    await expect(f.service.register(data)).rejects.toBeInstanceOf(BadRequestException);
    expect(f.user.create).not.toHaveBeenCalled();
  });
});
