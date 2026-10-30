import { BadRequestException, ConflictException, UnauthorizedException } from '@nestjs/common';
import { compare } from 'bcryptjs';
import { describe, it, expect } from 'vitest';
import { verificationFixture as fixture } from '../../test/verification-fixture.js';

const id = '12345678-1234-4234-8234-123456789abc';
const input = { fullName: ' Khách hàng ', email: ' TEST@example.com ', password: 'password123', confirmPassword: 'password123' };

describe('Integrated email registration and login', () => {
  it('registers a bcrypt account, logs in with the same password, and retrieves its profile', async () => {
    const f = fixture();
    const challenge = await f.service.register(input);
    expect(f.saved()).toBeNull();
    await expect(f.service.login({ email: input.email, password: input.password })).rejects.toBeInstanceOf(UnauthorizedException);
    const registered = await f.verification.verify({ registrationId: challenge.registrationId, code: f.code() });
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
