import { afterEach, describe, expect, it, vi } from 'vitest';
import { OAuth2Client } from 'google-auth-library';
import { compare } from 'bcryptjs';
import { verificationFixture } from '../../test/verification-fixture.js';
import { PasswordSetupService } from './password-setup.service.js';
import { VerificationMailService } from './verification-mail.service.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function fixture() {
  const f = verificationFixture();
  vi.stubEnv('GOOGLE_CLIENT_ID', 'test-client');
  vi.spyOn(OAuth2Client.prototype, 'verifyIdToken').mockResolvedValue({ getPayload: () => ({ sub: 'google-account', email: 'google@example.com', email_verified: true, name: 'Google customer' }) } as never);
  const login = await f.service.googleLogin({ credential: 'google-token' });
  const setup = new PasswordSetupService(f.prisma, f.mail as VerificationMailService);
  return { ...f, setup, id: login.user.id };
}
function body(challengeId: string, code: string) {
  return { challengeId, code, password: 'BrewLite-password-123', confirmPassword: 'BrewLite-password-123' };
}

describe('Google account password setup', () => {
  it('adds a password once and both login methods keep the same account', async () => {
    const f = await fixture();
    expect((await f.service.getCurrentUser(f.id)).hasPassword).toBe(false);
    const challenge = await f.setup.requestCode(f.id);
    expect(challenge).not.toHaveProperty('code');
    expect(f.mail.sendCode).toHaveBeenLastCalledWith('google@example.com', expect.stringMatching(/^\d{6}$/), 'password-setup');
    const results = await Promise.allSettled([f.setup.setPassword(f.id, body(challenge.challengeId, f.code())), f.setup.setPassword(f.id, body(challenge.challengeId, f.code()))]);
    expect(results.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect(await compare('BrewLite-password-123', f.saved()!.passwordHash!)).toBe(true);
    expect(f.passwordPending()).toBeNull();
    const profile = await f.service.getCurrentUser(f.id);
    expect(profile.hasPassword).toBe(true);
    expect(profile).not.toHaveProperty('passwordHash');
    const emailLogin = await f.service.login({ email: 'google@example.com', password: 'BrewLite-password-123' });
    const googleLogin = await f.service.googleLogin({ credential: 'google-token' });
    expect(emailLogin.user.id).toBe(f.id);
    expect(googleLogin.user.id).toBe(f.id);
    expect(emailLogin.user.hasPassword).toBe(true);
    expect(googleLogin.user.hasPassword).toBe(true);
    expect(f.user.create).toHaveBeenCalledTimes(1);
    await expect(f.setup.requestCode(f.id)).rejects.toThrow('đã có mật khẩu');
  });

  it('never accepts another account challenge and persists five wrong attempts', async () => {
    const f = await fixture();
    const challenge = await f.setup.requestCode(f.id);
    await expect(f.setup.setPassword('99999999-9999-4999-8999-999999999999', body(challenge.challengeId, f.code()))).rejects.toThrow('không còn tồn tại');
    expect(f.passwordPending()?.attempts).toBe(0);
    const wrong = f.code() === '000000' ? '111111' : '000000';
    for (let i = 1; i <= 5; i++) {
      await expect(f.setup.setPassword(f.id, body(challenge.challengeId, wrong))).rejects.toThrow('Mã không đúng');
      expect(f.passwordPending()?.attempts).toBe(i);
    }
    await expect(f.setup.setPassword(f.id, body(challenge.challengeId, f.code()))).rejects.toThrow('5 lần');
    expect(f.saved()?.passwordHash).toBeNull();
  });

  it('enforces cooldown, replaces old challenges and rejects expiration', async () => {
    const f = await fixture();
    const first = await f.setup.requestCode(f.id);
    await expect(f.setup.requestCode(f.id)).rejects.toThrow('Vui lòng đợi');
    f.passwordPending()!.sentAt = new Date(Date.now() - 61000);
    const second = await f.setup.requestCode(f.id);
    expect(second.challengeId).not.toBe(first.challengeId);
    await expect(f.setup.setPassword(f.id, body(first.challengeId, f.code()))).rejects.toThrow('thay thế');
    f.passwordPending()!.expiresAt = new Date(Date.now() - 1);
    await expect(f.setup.setPassword(f.id, body(second.challengeId, f.code()))).rejects.toThrow('hết hạn');
  });

  it('validates password input without consuming the code', async () => {
    const f = await fixture();
    const challenge = await f.setup.requestCode(f.id);
    const valid = body(challenge.challengeId, f.code());
    for (const data of [null, {}, { ...valid, code: '12' }, { ...valid, password: 'short' }, { ...valid, confirmPassword: 'different' }, { ...valid, password: 'á'.repeat(40), confirmPassword: 'á'.repeat(40) }]) {
      await expect(f.setup.setPassword(f.id, data)).rejects.toThrow();
    }
    expect(f.passwordPending()?.attempts).toBe(0);
    expect(f.saved()?.passwordHash).toBeNull();
  });

  it('rolls back SMTP failure and never overwrites an existing password', async () => {
    const f = await fixture();
    f.mail.sendCode.mockRejectedValueOnce(new Error('SMTP failure'));
    await expect(f.setup.requestCode(f.id)).rejects.toThrow('SMTP failure');
    expect(f.passwordPending()).toBeNull();
    const challenge = await f.setup.requestCode(f.id);
    await f.prisma.user.updateMany({ where: { id: f.id }, data: { passwordHash: 'existing-password-hash' } });
    await expect(f.setup.setPassword(f.id, body(challenge.challengeId, f.code()))).rejects.toThrow('đã có mật khẩu');
    expect(f.saved()?.passwordHash).toBe('existing-password-hash');
  });
});
