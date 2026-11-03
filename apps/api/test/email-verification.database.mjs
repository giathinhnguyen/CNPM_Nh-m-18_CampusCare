// Optional smoke test against the configured development database.
// Uses a fake mail sender, unique test addresses, and cleans up only its rows.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { hash } from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../dist/prisma/prisma.service.js';
import { EmailVerificationService } from '../dist/auth/email-verification.service.js';
import { AuthService } from '../dist/auth/auth.service.js';
import { PasswordSetupService } from '../dist/auth/password-setup.service.js';

if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to a development database first.');
const prisma = new PrismaService();
const email = `verification-smoke-${randomUUID()}@example.invalid`;
const rollbackEmail = `verification-smoke-${randomUUID()}@example.invalid`;
const googleEmail = `password-setup-smoke-${randomUUID()}@example.invalid`;
const emails = [email, rollbackEmail, googleEmail];
let code;
const mail = { sendCode: async (_email, value) => { code = value; } };
const verification = new EmailVerificationService(prisma, mail);
const auth = new AuthService(prisma, new JwtService({ secret: 'smoke-test-secret', signOptions: { expiresIn: '1h' } }), verification);
const password = 'Smoke-test-password-123';
try {
  const pending = await auth.register({ email, fullName: 'Verification smoke test', password, confirmPassword: password });
  assert.equal(await prisma.user.count({ where: { email } }), 0);
  await assert.rejects(auth.login({ email, password }));
  await assert.rejects(verification.resend(pending));
  const oldCode = code;
  const wrong = oldCode === '000000' ? '111111' : '000000';
  await assert.rejects(verification.verify({ registrationId: pending.registrationId, code: wrong }));
  assert.equal((await prisma.emailRegistration.findUniqueOrThrow({ where: { id: pending.registrationId } })).attempts, 1);
  await prisma.emailRegistration.update({ where: { id: pending.registrationId }, data: { sentAt: new Date(Date.now() - 61000) } });
  await verification.resend(pending);
  assert.notEqual(code, oldCode);
  await assert.rejects(verification.verify({ registrationId: pending.registrationId, code: oldCode }));
  const body = { registrationId: pending.registrationId, code };
  const concurrent = await Promise.allSettled([verification.verify(body), verification.verify(body)]);
  assert.equal(concurrent.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(await prisma.user.count({ where: { email } }), 1);
  assert.equal(await prisma.emailRegistration.count({ where: { email } }), 0);
  const login = await auth.login({ email, password });
  assert.equal(login.user.email, email);
  assert.equal('passwordHash' in login.user, false);
  const broken = new EmailVerificationService(prisma, { sendCode: async () => { throw new Error('simulated SMTP failure'); } });
  await assert.rejects(broken.start({ email: rollbackEmail, fullName: 'Rollback test', passwordHash: await hash(password, 12) }));
  assert.equal(await prisma.emailRegistration.count({ where: { email: rollbackEmail } }), 0);
  const googleId = randomUUID();
  const googleUser = await prisma.user.create({ data: { email: googleEmail, fullName: 'Google setup smoke test', googleId, passwordHash: null } });
  const setup = new PasswordSetupService(prisma, mail);
  assert.equal((await auth.getCurrentUser(googleUser.id)).hasPassword, false);
  const challenge = await setup.requestCode(googleUser.id);
  await assert.rejects(setup.requestCode(googleUser.id));
  const setupBody = { challengeId: challenge.challengeId, code, password, confirmPassword: password };
  const setupResults = await Promise.allSettled([setup.setPassword(googleUser.id, setupBody), setup.setPassword(googleUser.id, setupBody)]);
  assert.equal(setupResults.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal((await auth.getCurrentUser(googleUser.id)).hasPassword, true);
  assert.equal((await auth.login({ email: googleEmail, password })).user.id, googleUser.id);
  // Simulate Google's verified response; no external Google token/network call.
  auth.googleClient.verifyIdToken = async () => ({ getPayload: () => ({ sub: googleId, email: googleEmail, email_verified: true }) });
  assert.equal((await auth.googleLogin({ credential: 'smoke-verified-response' })).user.id, googleUser.id);
  assert.equal(await prisma.user.count({ where: { email: googleEmail } }), 1);
  await assert.rejects(setup.requestCode(googleUser.id));
  assert.equal(await prisma.passwordSetupChallenge.count({ where: { userId: googleUser.id } }), 0);
  console.log('Database smoke passed: email registration, resend, single-use verification, SMTP rollback, Google password setup and alternating login on the same account. No real email sent; Google response simulated.');
} finally {
  await prisma.emailRegistration.deleteMany({ where: { email: { in: emails } } });
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
}
