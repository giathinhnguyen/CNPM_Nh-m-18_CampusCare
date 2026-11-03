import { vi } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import type { EmailRegistration, PasswordSetupChallenge, User } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service.js';
import { VerificationMailService } from '../src/auth/verification-mail.service.js';
import { EmailVerificationService } from '../src/auth/email-verification.service.js';
import { AuthService } from '../src/auth/auth.service.js';

export function verificationFixture() {
  let saved: User | null = null;
  let pending: EmailRegistration | null = null;
  let passwordPending: PasswordSetupChallenge | null = null;
  const mail = { sendCode: vi.fn(async (_email: string, _code: string, _purpose?: string) => {}) };
  const user = {
    findFirst: vi.fn(async () => saved),
    findUnique: vi.fn(async ({ where }: { where: Record<string, unknown> }) => saved && Object.entries(where).every(([key, value]) => saved?.[key as keyof User] === value) ? saved : null),
    create: vi.fn(async ({ data, select }: { data: Partial<User>; select?: unknown }) => {
      saved = { id: '12345678-1234-4234-8234-123456789abc', role: 'CUSTOMER', loyaltyPoints: 0, googleId: null, passwordHash: null, createdAt: new Date(), updatedAt: new Date(), ...data } as User;
      return select ? { id: saved.id, fullName: saved.fullName, email: saved.email } : saved;
    }),
    updateMany: vi.fn(async ({ data, where }: { data: Partial<User>; where?: Partial<User> }) => {
      if (!saved || (where && !Object.entries(where).every(([key, value]) => saved?.[key as keyof User] === value))) return { count: 0 };
      saved = { ...saved, ...data };
      return { count: 1 };
    }),
  };
  const emailRegistration = {
    findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) => pending && (!where.id || where.id === pending.id) && (!where.email || where.email === pending.email) ? { ...pending } : null),
    create: vi.fn(async ({ data }: { data: EmailRegistration }) => { pending = { ...data }; return pending; }),
    deleteMany: vi.fn(async () => { pending = null; return { count: 1 }; }),
    delete: vi.fn(async () => { pending = null; }),
    update: vi.fn(async ({ data }: { data: Omit<Partial<EmailRegistration>, 'attempts'> & { attempts?: number | { increment: number } } }) => {
      if (!pending) throw new Error('Missing pending registration');
      const attempts = typeof data.attempts === 'object' ? pending.attempts + data.attempts.increment : data.attempts ?? pending.attempts;
      pending = { ...pending, ...data, attempts };
      return pending;
    }),
  };
  const passwordSetupChallenge = {
    findUnique: vi.fn(async ({ where }: { where: { userId: string } }) => passwordPending?.userId === where.userId ? { ...passwordPending } : null),
    create: vi.fn(async ({ data }: { data: PasswordSetupChallenge }) => { passwordPending = { ...data }; return passwordPending; }),
    deleteMany: vi.fn(async () => { passwordPending = null; return { count: 1 }; }),
    delete: vi.fn(async () => { passwordPending = null; }),
    update: vi.fn(async ({ data }: { data: { attempts: { increment: number } } }) => {
      if (!passwordPending) throw new Error('Missing password challenge');
      passwordPending.attempts += data.attempts.increment;
      return passwordPending;
    }),
  };
  const tx = { user, emailRegistration, passwordSetupChallenge, $executeRaw: vi.fn(async () => 0) };
  let queue = Promise.resolve();
  const prisma = {
    ...tx,
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<unknown>) => {
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const before = structuredClone({ saved, pending, passwordPending });
      try { return await fn(tx); }
      catch (error) { saved = before.saved; pending = before.pending; passwordPending = before.passwordPending; throw error; }
      finally { release(); }
    }),
  } as unknown as PrismaService;
  const jwt = new JwtService({ secret: 'integration-test-secret', signOptions: { expiresIn: '1h' } });
  const verification = new EmailVerificationService(prisma, mail as VerificationMailService);
  const service = new AuthService(prisma, jwt, verification);
  return { service, verification, user, mail, jwt, prisma, passwordPending: () => passwordPending, pending: () => pending, saved: () => saved,
    code: () => mail.sendCode.mock.calls.at(-1)![1],
    age: (milliseconds: number) => { if (pending) pending.sentAt = new Date(Date.now() - milliseconds); },
    expire: () => { if (pending) pending.expiresAt = new Date(Date.now() - 1); },
  };
}
