import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
  ServiceUnavailableException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare, hash } from 'bcryptjs';
import { isEmail } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { OAuth2Client } from 'google-auth-library';
import { Prisma } from '@prisma/client';
import { EmailVerificationService } from './email-verification.service.js';

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly verification: EmailVerificationService,
  ) {}

  async login(body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Thông tin đăng nhập không hợp lệ.');
    }

    const data = body as Record<string, unknown>;

    const email =
      typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';

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
        hasPassword: !!user.passwordHash,
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
        passwordHash: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.',
      );
    }

    const { passwordHash, ...profile } = user;
    return { ...profile, hasPassword: !!passwordHash };
  }
  async googleLogin(body: unknown) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Thông tin đăng nhập không hợp lệ.');
    }

    const { credential, password } = body as Record<string, unknown>;

    if (typeof credential !== 'string' || !credential) {
      throw new BadRequestException('Thiếu token xác thực Google.');
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;

    if (!clientId) {
      throw new ServiceUnavailableException(
        'Đăng nhập Google chưa được cấu hình.',
      );
    }

    // Chỉ bắt lỗi xác minh Google trong khối này.
    const payload = await this.googleClient
      .verifyIdToken({
        idToken: credential,
        audience: clientId,
      })
      .then((ticket) => ticket.getPayload())
      .catch(() => {
        throw new UnauthorizedException(
          'Token Google không hợp lệ hoặc đã hết hạn.',
        );
      });

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException(
        'Tài khoản Google chưa có email được xác minh.',
      );
    }

    const googleId = payload.sub;
    const email = payload.email.trim().toLowerCase();

    if (email.length > 255 || googleId.length > 255) {
      throw new UnauthorizedException(
        'Thông tin tài khoản Google không hợp lệ.',
      );
    }

    // Google xác thực danh tính; BrewLite vẫn lưu User để gắn đơn hàng và điểm.
    // Dùng sub của Google làm định danh liên kết, không dùng mật khẩu Google.
    let user = await this.prisma.user.findUnique({
      where: { googleId },
    });

    if (!user) {
      const existingEmailUser = await this.prisma.user.findFirst({
        where: {
          email: {
            equals: email,
            mode: 'insensitive',
          },
        },
      });

      if (existingEmailUser) {
        if (existingEmailUser.googleId || !existingEmailUser.passwordHash) {
          throw new ConflictException(
            'Tài khoản đã liên kết với phương thức khác.',
          );
        }
        if (password === undefined) {
          throw new ConflictException({
            code: 'GOOGLE_LINK_REQUIRED',
            message:
              'Email này đã có tài khoản. Nhập mật khẩu BrewLite để liên kết Google.',
          });
        }
        if (
          typeof password !== 'string' ||
          !password ||
          Buffer.byteLength(password, 'utf8') > 72 ||
          !(await compare(password, existingEmailUser.passwordHash))
        ) {
          throw new UnauthorizedException('Mật khẩu BrewLite không đúng.');
        }
        // Chỉ liên kết nếu tài khoản chưa được liên kết bởi yêu cầu khác.
        const linked = await this.prisma.user.updateMany({
          where: {
            id: existingEmailUser.id,
            googleId: null,
            passwordHash: existingEmailUser.passwordHash,
          },
          data: { googleId },
        });
        if (linked.count !== 1) {
          throw new ConflictException(
            'Tài khoản vừa thay đổi. Vui lòng thử đăng nhập Google lại.',
          );
        }
        user = await this.prisma.user.findUnique({ where: { googleId } });
      } else {
        try {
          user = await this.prisma.user.create({
            data: {
              googleId,
              email,
              // Tài khoản chỉ dùng Google không có mật khẩu BrewLite.
              passwordHash: null,
              fullName: (payload.name?.trim() || email.split('@')[0]).slice(
                0,
                100,
              ),
            },
          });
        } catch (error) {
          if (
            !(error instanceof Prisma.PrismaClientKnownRequestError) ||
            error.code !== 'P2002'
          ) {
            throw error;
          }
          user = await this.prisma.user.findUnique({ where: { googleId } });
          if (!user) {
            throw new ConflictException(
              'Tài khoản vừa được tạo. Vui lòng thử đăng nhập Google lại.',
            );
          }
        }
      }
    }

    if (!user) throw new UnauthorizedException('Không tìm thấy tài khoản.');
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
        hasPassword: !!user.passwordHash,
      },
    };
  }
  async register(body: unknown) {
    // Kiểm tra dữ liệu gửi lên phải là một object.
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new BadRequestException('Thông tin đăng ký không hợp lệ.');
    }

    const data = body as Record<string, unknown>;

    const fullName =
      typeof data.fullName === 'string' ? data.fullName.trim() : '';

    const email =
      typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';

    const password = data.password;
    const confirmPassword = data.confirmPassword;

    // Kiểm tra dữ liệu đầu vào.
    if (!fullName || fullName.length > 100) {
      throw new BadRequestException('Họ tên phải có từ 1 đến 100 ký tự.');
    }

    if (email.length > 255 || !isEmail(email)) {
      throw new BadRequestException('Email không hợp lệ.');
    }

    if (typeof password !== 'string' || password.length < 8) {
      throw new BadRequestException('Mật khẩu phải có ít nhất 8 ký tự.');
    }

    // bcrypt chỉ xử lý tối đa 72 byte của mật khẩu.
    if (Buffer.byteLength(password, 'utf8') > 72) {
      throw new BadRequestException(
        'Mật khẩu không được vượt quá 72 byte UTF-8.',
      );
    }

    if (typeof confirmPassword !== 'string' || password !== confirmPassword) {
      throw new BadRequestException('Mật khẩu xác nhận chưa trùng khớp.');
    }

    // Kiểm tra email đã có tài khoản hay chưa.
    const existingUser = await this.prisma.user.findFirst({
      where: {
        email: {
          equals: email,
          mode: 'insensitive',
        },
      },
      select: { id: true, googleId: true, passwordHash: true },
    });

    if (existingUser) {
      if (existingUser.googleId && !existingUser.passwordHash) {
        throw new ConflictException(
          'Email này đã có tài khoản Google. Vui lòng đăng nhập bằng Google và đặt mật khẩu BrewLite trong trang Tài khoản.',
        );
      }
      throw new ConflictException('Email đã được sử dụng.');
    }

    // Băm mật khẩu với salt tự động, cost = 12.
    const passwordHash = await hash(password, 12);

    return this.verification.start({ email, fullName, passwordHash });
  }
}
