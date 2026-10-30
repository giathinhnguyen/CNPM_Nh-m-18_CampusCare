import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { describe, it, expect, vi } from 'vitest';
import { AuthGuard } from './auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

const id = '12345678-1234-4234-8234-123456789abc';
const jwt = new JwtService({ secret: 'test-secret-for-auth-guard' });

function fixture(authorization?: string, exists = true) {
  const request = { headers: { authorization }, user: undefined };
  const findUnique = vi.fn().mockResolvedValue(exists ? { id } : null);
  const prisma = { user: { findUnique } } as unknown as PrismaService;
  const guard = new AuthGuard(jwt, prisma);
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext;
  return { request, findUnique, run: () => guard.canActivate(context) };
}

describe('AuthGuard', () => {
  it.each([undefined, '', 'Basic abc', 'Bearer', 'Bearer a b'])('rejects missing/malformed header %s', async (header) => {
    const f = fixture(header);
    await expect(f.run()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.findUnique).not.toHaveBeenCalled();
  });

  it('accepts a valid JWT and attaches its account identity', async () => {
    const f = fixture(`Bearer ${jwt.sign({ sub: id }, { expiresIn: '1h' })}`);
    await expect(f.run()).resolves.toBe(true);
    expect(f.request.user).toEqual({ id });
    expect(f.findUnique).toHaveBeenCalledWith({ where: { id }, select: { id: true } });
  });

  it.each([
    jwt.sign({ sub: id }, { expiresIn: -1 }),
    jwt.sign({ sub: id }),
    jwt.sign({ sub: 'invalid-id' }, { expiresIn: '1h' }),
    new JwtService({ secret: 'other-secret' }).sign({ sub: id }, { expiresIn: '1h' }),
    'invalid-token',
  ])('rejects expired, malformed or incorrectly signed tokens', async (token) => {
    const f = fixture(`Bearer ${token}`);
    await expect(f.run()).rejects.toBeInstanceOf(UnauthorizedException);
    expect(f.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a deleted account even with a valid JWT', async () => {
    const f = fixture(`Bearer ${jwt.sign({ sub: id }, { expiresIn: '1h' })}`, false);
    await expect(f.run()).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('does not misreport a database outage as invalid credentials', async () => {
    const f = fixture(`Bearer ${jwt.sign({ sub: id }, { expiresIn: '1h' })}`);
    f.findUnique.mockRejectedValue(new Error('database unavailable'));
    await expect(f.run()).rejects.toThrow('database unavailable');
  });
});
