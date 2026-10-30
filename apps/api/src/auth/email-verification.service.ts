import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { VerificationMailService } from './verification-mail.service.js';

const CODE_LIFETIME = 5 * 60 * 1000;
const RESEND_DELAY = 60 * 1000;
const MAX_ATTEMPTS = 5;

@Injectable()
export class EmailVerificationService {
  constructor(private readonly prisma: PrismaService, private readonly mail: VerificationMailService) {}

  private async lockEmail(tx: Prisma.TransactionClient, email: string) {
    // Serialize register/resend/verify for the same address across API instances.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${email}))`;
  }

  private enforceCooldown(sentAt: Date) {
    const remaining = Math.ceil((sentAt.getTime() + RESEND_DELAY - Date.now()) / 1000);
    if (remaining > 0) {
      throw new HttpException({ message: `Vui lòng đợi ${remaining} giây trước khi gửi lại mã.`, retryAfter: remaining }, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private response(id: string, email: string, expiresAt: Date) {
    return { message: 'Mã xác minh đã được gửi. Vui lòng kiểm tra email và thư rác.', registrationId: id, email, expiresAt: expiresAt.toISOString(), resendAfter: 60 };
  }

  async start(input: { email: string; fullName: string; passwordHash: string }) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockEmail(tx, input.email);
      const user = await tx.user.findFirst({ where: { email: { equals: input.email, mode: 'insensitive' } }, select: { id: true } });
      if (user) throw new ConflictException('Email đã được sử dụng.');
      const previous = await tx.emailRegistration.findUnique({ where: { email: input.email } });
      if (previous) this.enforceCooldown(previous.sentAt);
      const id = randomUUID();
      const code = randomInt(0, 1000000).toString().padStart(6, '0');
      const codeHash = await hash(code, 12);
      const sentAt = new Date();
      const expiresAt = new Date(sentAt.getTime() + CODE_LIFETIME);
      // Rotate the challenge ID if credentials change; an old form cannot verify
      // a different registration request for the same address.
      await tx.emailRegistration.deleteMany({ where: { email: input.email } });
      await tx.emailRegistration.create({ data: { ...input, id, codeHash, attempts: 0, sentAt, expiresAt } });
      await this.mail.sendCode(input.email, code);
      return this.response(id, input.email, expiresAt);
    }, { timeout: 30000 });
  }

  private parse(body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Thông tin xác minh không hợp lệ.');
    const data = body as Record<string, unknown>;
    if (typeof data.registrationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.registrationId)) {
      throw new BadRequestException('Yêu cầu đăng ký không hợp lệ. Vui lòng đăng ký lại.');
    }
    return { id: data.registrationId, code: data.code };
  }

  async resend(body: unknown) {
    const { id } = this.parse(body);
    const request = await this.prisma.emailRegistration.findUnique({ where: { id } });
    if (!request) throw new BadRequestException('Yêu cầu đăng ký không còn tồn tại. Vui lòng đăng ký lại.');
    return this.prisma.$transaction(async (tx) => {
      await this.lockEmail(tx, request.email);
      const pending = await tx.emailRegistration.findUnique({ where: { id } });
      if (!pending) throw new BadRequestException('Yêu cầu đăng ký không còn tồn tại.');
      this.enforceCooldown(pending.sentAt);
      const user = await tx.user.findUnique({ where: { email: pending.email }, select: { id: true } });
      if (user) throw new ConflictException('Email đã có tài khoản. Vui lòng đăng nhập.');
      let code: string;
      do {
        code = randomInt(0, 1000000).toString().padStart(6, '0');
      } while (await compare(code, pending.codeHash));
      const codeHash = await hash(code, 12);
      const sentAt = new Date();
      const expiresAt = new Date(sentAt.getTime() + CODE_LIFETIME);
      await tx.emailRegistration.update({ where: { id }, data: { codeHash, attempts: 0, sentAt, expiresAt } });
      // A failed delivery rolls back the new code, preserving the previous code.
      await this.mail.sendCode(pending.email, code);
      return this.response(id, pending.email, expiresAt);
    }, { timeout: 30000 });
  }

  async verify(body: unknown) {
    const { id, code } = this.parse(body);
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new BadRequestException('Vui lòng nhập mã xác minh gồm 6 chữ số.');
    const request = await this.prisma.emailRegistration.findUnique({ where: { id } });
    if (!request) throw new BadRequestException('Yêu cầu đăng ký không còn tồn tại hoặc đã được xác minh.');
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await this.lockEmail(tx, request.email);
        const pending = await tx.emailRegistration.findUnique({ where: { id } });
        if (!pending) return { error: 'Mã đã được sử dụng hoặc yêu cầu đăng ký đã thay đổi.' };
        if (pending.attempts >= MAX_ATTEMPTS) return { error: 'Bạn đã nhập sai 5 lần. Vui lòng gửi lại mã mới.' };
        if (pending.expiresAt.getTime() <= Date.now()) return { error: 'Mã xác minh đã hết hạn. Vui lòng gửi lại mã.' };
        if (!(await compare(code, pending.codeHash))) {
          await tx.emailRegistration.update({ where: { id }, data: { attempts: { increment: 1 } } });
          // Return the error so the increment commits before throwing outside.
          return { error: `Mã xác minh không đúng. Còn ${MAX_ATTEMPTS - pending.attempts - 1} lần thử.` };
        }
        const existing = await tx.user.findFirst({ where: { email: { equals: pending.email, mode: 'insensitive' } }, select: { id: true } });
        if (existing) throw new ConflictException('Email đã có tài khoản. Vui lòng đăng nhập.');
        const user = await tx.user.create({
          data: { email: pending.email, fullName: pending.fullName, passwordHash: pending.passwordHash },
          select: { id: true, fullName: true, email: true },
        });
        await tx.emailRegistration.delete({ where: { id } });
        return { user };
      }, { timeout: 15000 });
      if ('error' in result) throw new BadRequestException(result.error);
      return { message: 'Xác minh email thành công. Bạn có thể đăng nhập.', user: result.user };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Email đã có tài khoản. Vui lòng đăng nhập.');
      throw error;
    }
  }
}
