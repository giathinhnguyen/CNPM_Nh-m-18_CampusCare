import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import { isEmail } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async register(body: unknown) {
    // Kiểm tra dữ liệu gửi lên phải là một object.
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Thông tin đăng ký không hợp lệ.');
    }

    const data = body as Record<string, unknown>;

    const fullName =
      typeof data.fullName === 'string' ? data.fullName.trim() : '';

    const email =
      typeof data.email === 'string'
        ? data.email.trim().toLowerCase()
        : '';

    const password = data.password;
    const confirmPassword = data.confirmPassword;

    // Kiểm tra dữ liệu đầu vào.
    if (!fullName || fullName.length > 100) {
      throw new BadRequestException(
        'Họ tên phải có từ 1 đến 100 ký tự.',
      );
    }

    if (email.length > 255 || !isEmail(email)) {
      throw new BadRequestException('Email không hợp lệ.');
    }

    if (typeof password !== 'string' || password.length < 8) {
      throw new BadRequestException(
        'Mật khẩu phải có ít nhất 8 ký tự.',
      );
    }

    // bcrypt chỉ xử lý tối đa 72 byte của mật khẩu.
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException(
        'Mật khẩu không được vượt quá 72 byte UTF-8.',
      );
    }

    if (
      typeof confirmPassword !== 'string' ||
      password !== confirmPassword
    ) {
      throw new BadRequestException(
        'Mật khẩu xác nhận chưa trùng khớp.',
      );
    }

    // Kiểm tra email đã có tài khoản hay chưa.
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      select: { id: true },
    });

    if (existingUser) {
      throw new ConflictException('Email đã được sử dụng.');
    }

    // Băm mật khẩu với salt tự động, cost = 12.
    const passwordHash = await hash(password, 12);

    try {
      const user = await this.prisma.user.create({
        data: {
          fullName,
          email,
          passwordHash,
        },
        select: {
          id: true,
          fullName: true,
          email: true,
        },
      });

      return {
        message: 'Đăng ký thành công.',
        user,
      };
    } catch (error) {
      // Xử lý trường hợp hai yêu cầu cùng đăng ký một email.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email đã được sử dụng.');
      }

      throw error;
    }
  }
}