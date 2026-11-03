import { BadRequestException, ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { randomInt, randomUUID } from 'node:crypto';
import { compare, hash } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { VerificationMailService } from './verification-mail.service.js';

@Injectable()
export class PasswordSetupService {
  constructor(private readonly prisma: PrismaService, private readonly mail: VerificationMailService) {}

  async requestCode(userId: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true, googleId: true, passwordHash: true } });
      if (!user) throw new UnauthorizedException('Tài khoản không còn tồn tại.');
      if (user.passwordHash) throw new ConflictException('Tài khoản đã có mật khẩu BrewLite.');
      if (!user.googleId) throw new BadRequestException('Tài khoản chưa liên kết Google.');
      const previous = await tx.passwordSetupChallenge.findUnique({ where: { userId } });
      if (previous) {
        const retryAfter = Math.ceil((previous.sentAt.getTime() + 60000 - Date.now()) / 1000);
        if (retryAfter > 0) throw new HttpException({ message: `Vui lòng đợi ${retryAfter} giây trước khi gửi lại mã.`, retryAfter }, HttpStatus.TOO_MANY_REQUESTS);
      }
      const code = randomInt(0, 1000000).toString().padStart(6, '0');
      const codeHash = await hash(code, 12);
      const id = randomUUID();
      const sentAt = new Date();
      const expiresAt = new Date(sentAt.getTime() + 300000);
      await tx.passwordSetupChallenge.deleteMany({ where: { userId } });
      await tx.passwordSetupChallenge.create({ data: { id, userId, codeHash, attempts: 0, sentAt, expiresAt } });
      await this.mail.sendCode(user.email, code, 'password-setup');
      return { challengeId: id, email: user.email, expiresAt: expiresAt.toISOString(), resendAfter: 60, message: 'Đã gửi mã xác minh đặt mật khẩu đến email của bạn.' };
    }, { timeout: 30000 });
  }

  async setPassword(userId: string, body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new BadRequestException('Thông tin đặt mật khẩu không hợp lệ.');
    const { challengeId, code, password, confirmPassword } = body as Record<string, unknown>;
    if (typeof challengeId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(challengeId) || typeof code !== 'string' || !/^\d{6}$/.test(code)) {
      throw new BadRequestException('Vui lòng nhập mã xác minh 6 chữ số và dùng yêu cầu hợp lệ.');
    }
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự và không quá 72 byte UTF-8.');
    if (password !== confirmPassword) throw new BadRequestException('Mật khẩu xác nhận chưa trùng khớp.');
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${userId}))`;
      const user = await tx.user.findUnique({ where: { id: userId }, select: { passwordHash: true, googleId: true } });
      if (!user) throw new UnauthorizedException('Tài khoản không còn tồn tại.');
      if (user.passwordHash) throw new ConflictException('Tài khoản đã có mật khẩu BrewLite.');
      if (!user.googleId) throw new BadRequestException('Tài khoản chưa liên kết Google.');
      const pending = await tx.passwordSetupChallenge.findUnique({ where: { userId } });
      if (!pending || pending.id !== challengeId) return { error: 'Yêu cầu xác minh không tồn tại hoặc đã được thay thế. Hãy gửi lại mã.' };
      if (pending.attempts >= 5) return { error: 'Bạn đã nhập sai 5 lần. Vui lòng gửi lại mã mới.' };
      if (pending.expiresAt.getTime() <= Date.now()) return { error: 'Mã đã hết hạn. Vui lòng gửi lại mã.' };
      if (!(await compare(code, pending.codeHash))) {
        await tx.passwordSetupChallenge.update({ where: { userId }, data: { attempts: { increment: 1 } } });
        return { error: `Mã không đúng. Còn ${4 - pending.attempts} lần thử.` };
      }
      const passwordHash = await hash(password, 12);
      // Never overwrite an existing password, even if another request raced us.
      const updated = await tx.user.updateMany({ where: { id: userId, passwordHash: null }, data: { passwordHash } });
      if (updated.count !== 1) throw new ConflictException('Tài khoản đã có mật khẩu BrewLite.');
      await tx.passwordSetupChallenge.delete({ where: { userId } });
      return { success: true };
    }, { timeout: 15000 });
    if ('error' in result) throw new BadRequestException(result.error);
    return { message: 'Đã đặt mật khẩu BrewLite. Bạn có thể đăng nhập bằng Google hoặc email và mật khẩu này.' };
  }
}
