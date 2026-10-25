import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Thông tin đăng nhập không hợp lệ.');
    }

    const data = body as Record<string, unknown>;

    const email =
      typeof data.email === 'string'
        ? data.email.trim().toLowerCase()
        : '';

    const password = data.password;

    if (
      !email ||
      email.length > 255 ||
      typeof password !== 'string' ||
      !password
    ) {
      throw new BadRequestException('Vui lòng nhập email và mật khẩu.');
    }

    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        loyaltyPoints: true,
        passwordHash: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }

    // Không cho bcrypt bỏ qua phần mật khẩu vượt quá 72 byte.
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }

    const passwordMatches = await compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng.');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        loyaltyPoints: user.loyaltyPoints,
      },
    };
  }
  async getCurrentUser(userId: string) {
  const user = await this.prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      loyaltyPoints: true,
    },
  });

  if (!user) {
    throw new UnauthorizedException(
      'Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.',
    );
  }

  return user;
}
}