import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AuthenticatedUser {
  id: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    const match = authorization?.match(/^Bearer ([^\s]+)$/i);

    if (!match) {
      throw new UnauthorizedException('Vui lòng đăng nhập.');
    }

    let userId: string;
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: unknown;
        exp?: unknown;
      }>(match[1], {
        algorithms: ['HS256'],
      });

      if (
        typeof payload.sub !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.sub) ||
        typeof payload.exp !== 'number' ||
        !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000
      ) {
        throw new Error('Invalid token payload');
      }

      userId = payload.sub;
    } catch {
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    }
    // Keep database failures separate from invalid credentials.
    const user = await this.prisma.user.findUnique({
      where: { id: userId }, select: { id: true },
    });
    if (!user) throw new UnauthorizedException('Tài khoản không còn tồn tại. Vui lòng đăng nhập lại.');
    (request as AuthenticatedRequest).user = { id: user.id };
    return true;
  }
}
