import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly auth: AuthGuard,
    private readonly prisma: PrismaService,
  ) {}
  async canActivate(context: ExecutionContext) {
    await this.auth.canActivate(context);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.prisma.user.findUnique({
      where: { id: request.user.id },
      select: { role: true },
    });
    if (user?.role !== 'ADMIN')
      throw new ForbiddenException('Chỉ quản trị viên được truy cập.');
    return true;
  }
}
