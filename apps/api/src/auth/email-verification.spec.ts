import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { compare } from 'bcryptjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verificationFixture } from '../../test/verification-fixture.js';

const input = { fullName: 'Khách hàng', email: 'test@example.com', password: 'password123', confirmPassword: 'password123' };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('Email verification', () => {
  it('stores hashed credentials, hides the code and only creates the user once', async () => {
    const f = verificationFixture();
    const result = await f.service.register(input);
    const code = f.code();
    expect(code).toMatch(/^\d{6}$/);
    expect(result).not.toHaveProperty('code');
    expect(f.saved()).toBeNull();
    expect(f.pending()?.passwordHash).not.toBe(input.password);
    expect(await compare(code, f.pending()!.codeHash)).toBe(true);
    expect(f.pending()?.codeHash).not.toBe(code);
    const body = { registrationId: result.registrationId, code };
    const results = await Promise.allSettled([f.verification.verify(body), f.verification.verify(body)]);
    expect(results.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(f.user.create).toHaveBeenCalledTimes(1);
    expect(f.pending()).toBeNull();
    await expect(f.verification.verify(body)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('persists failed attempts and blocks even a correct code after five failures', async () => {
    const f = verificationFixture();
    const result = await f.service.register(input);
    const wrong = f.code() === '000000' ? '111111' : '000000';
    for (let count = 1; count <= 5; count++) {
      await expect(f.verification.verify({ registrationId: result.registrationId, code: wrong })).rejects.toBeInstanceOf(BadRequestException);
      expect(f.pending()?.attempts).toBe(count);
    }
    await expect(f.verification.verify({ registrationId: result.registrationId, code: f.code() })).rejects.toThrow('5 lần');
    expect(f.saved()).toBeNull();
  });

  it('rejects expired codes and invalid request shapes', async () => {
    const f = verificationFixture();
    const result = await f.service.register(input);
    f.expire();
    await expect(f.verification.verify({ registrationId: result.registrationId, code: f.code() })).rejects.toThrow('hết hạn');
    for (const body of [null, [], {}, { registrationId: 'bad', code: '123456' }, { registrationId: result.registrationId, code: '123' }]) {
      await expect(f.verification.verify(body)).rejects.toBeInstanceOf(BadRequestException);
    }
    expect(f.saved()).toBeNull();
  });

  it('enforces resend and registration cooldown and resets attempts after resending', async () => {
    const f = verificationFixture();
    const result = await f.service.register(input);
    await expect(f.verification.resend(result)).rejects.toBeInstanceOf(HttpException);
    await expect(f.service.register(input)).rejects.toBeInstanceOf(HttpException);
    expect(f.mail.sendCode).toHaveBeenCalledTimes(1);
    f.age(61000);
    const oldCode = f.code();
    await f.verification.resend(result);
    expect(f.mail.sendCode).toHaveBeenCalledTimes(2);
    expect(f.pending()?.attempts).toBe(0);
    await expect(f.verification.verify({ registrationId: result.registrationId, code: oldCode })).rejects.toThrow('không đúng');
    await f.verification.verify({ registrationId: result.registrationId, code: f.code() });
    expect(f.saved()?.email).toBe(input.email);
  });

  it('rolls back pending data if email delivery fails, including on resend', async () => {
    const f = verificationFixture();
    f.mail.sendCode.mockRejectedValueOnce(new Error('smtp unavailable'));
    await expect(f.service.register(input)).rejects.toThrow('smtp unavailable');
    expect(f.pending()).toBeNull();
    const result = await f.service.register(input);
    const oldCode = f.code();
    const oldHash = f.pending()!.codeHash;
    f.age(61000);
    f.mail.sendCode.mockRejectedValueOnce(new Error('smtp unavailable'));
    await expect(f.verification.resend(result)).rejects.toThrow('smtp unavailable');
    expect(f.pending()!.codeHash).toBe(oldHash);
    await f.verification.verify({ registrationId: result.registrationId, code: oldCode });
    expect(f.saved()).not.toBeNull();
  });

  it('rotates the challenge when a new registration replaces credentials', async () => {
    const f = verificationFixture();
    const old = await f.service.register(input);
    f.age(61000);
    const current = await f.service.register({ ...input, fullName: 'Tên mới' });
    expect(current.registrationId).not.toBe(old.registrationId);
    await expect(f.verification.verify({ registrationId: old.registrationId, code: f.code() })).rejects.toBeInstanceOf(BadRequestException);
    await f.verification.verify({ registrationId: current.registrationId, code: f.code() });
    expect(f.saved()?.fullName).toBe('Tên mới');
  });

  it('creates and reuses a Google account without sending an email code', async () => {
    const f = verificationFixture();
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({ getPayload: () => ({ sub: 'google-id', email: input.email, email_verified: true, name: input.fullName }) } as never);
    const first = await f.service.googleLogin({ credential: 'verified-google-token' });
    const second = await f.service.googleLogin({ credential: 'verified-google-token' });
    expect(first.user.id).toBe(second.user.id);
    expect(f.user.create).toHaveBeenCalledTimes(1);
    expect(f.saved()?.passwordHash).toBeNull();
    expect(f.mail.sendCode).not.toHaveBeenCalled();
  });

  it('rejects unverified Google email and requires proof before linking a password account', async () => {
    const f = verificationFixture();
    vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
    const google = vi.spyOn(OAuth2Client.prototype, 'verifyIdToken');
    google.mockResolvedValue({ getPayload: () => ({ sub: 'google-id', email: input.email, email_verified: false }) } as never);
    await expect(f.service.googleLogin({ credential: 'token' })).rejects.toThrow('chưa có email');
    const registration = await f.service.register(input);
    await f.verification.verify({ registrationId: registration.registrationId, code: f.code() });
    google.mockResolvedValue({ getPayload: () => ({ sub: 'google-id', email: input.email, email_verified: true }) } as never);
    await expect(f.service.googleLogin({ credential: 'token' })).rejects.toBeInstanceOf(ConflictException);
    const linked = await f.service.googleLogin({ credential: 'token', password: input.password });
    expect(linked.user.email).toBe(input.email);
    expect(f.saved()?.googleId).toBe('google-id');
    expect(f.user.create).toHaveBeenCalledTimes(1);
  });
});
