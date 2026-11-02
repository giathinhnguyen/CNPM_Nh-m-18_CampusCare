import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { AdminGuard } from './admin.guard.js';
import { AdminService } from './admin.service.js';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly prisma: PrismaService,
  ) {}
  @Get('me') me(@Req() req: AuthenticatedRequest) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: req.user.id },
      select: { id: true, email: true, fullName: true, role: true },
    });
  }
  @Get('overview') overview() {
    return this.admin.overview();
  }
  @Get('customers/:id/orders') orders(@Param('id') id: string) {
    return this.admin.customerOrders(id);
  }
  @Post('ingredients') ingredient(@Body() body: unknown) {
    return this.admin.write(() => this.admin.ingredient(null, body));
  }
  @Patch('ingredients/:id') editIngredient(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.admin.write(() => this.admin.ingredient(id, body));
  }
  @Post('products') product(@Body() body: unknown) {
    return this.admin.write(() => this.admin.product(null, body));
  }
  @Patch('products/:id') editProduct(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.admin.write(() => this.admin.product(id, body));
  }
  @Patch('sizes/:id/recipe') recipe(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.admin.write(() => this.admin.recipe(id, body));
  }
  @Post('promotions') promotion(@Body() body: unknown) {
    return this.admin.write(() => this.admin.promotion(null, body));
  }
  @Patch('promotions/:id') editPromotion(
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    return this.admin.write(() => this.admin.promotion(id, body));
  }
}
