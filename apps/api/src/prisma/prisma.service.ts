import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // Kết nối database khi NestJS khởi động module.
  async onModuleInit() {
    await this.$connect();
  }

  // Đóng kết nối khi NestJS dừng.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
