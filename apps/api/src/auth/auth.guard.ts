import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const authorization = request.headers.authorization;

    const match = authorization?.match(/^Bearer ([^\s]+)$/i);

    if (!match) {
      throw new UnauthorizedException('Vui lòng đăng nhập.');
    }

    try {
      const payload = await this.jwtService.verifyAsync<{
        sub?: unknown;
        exp?: unknown;
      }>(match[1], {
        algorithms: ['HS256'],
      });

      if (
        typeof payload.sub !== 'string' ||
        !payload.sub ||
        typeof payload.exp !== 'number'
      ) {
        throw new Error('Invalid token payload');
      }

      (request as AuthenticatedRequest).user = {
        id: payload.sub,
      };

      return true;
    } catch {
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
      );
    }
  }
}