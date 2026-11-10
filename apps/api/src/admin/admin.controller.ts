import {
  ApiTags,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';
import { ApiRequestBody } from '../swagger/request-bodies.js';
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

@ApiTags('admin')
@ApiForbiddenResponse({ description: 'ADMIN role required.' })
@Controller('admin')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
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
  @ApiRequestBody('ingredient')
  @Post('ingredients')
  ingredient(@Body() body: unknown) {
    return this.admin.write(() => this.admin.ingredient(null, body));
  }
  @ApiRequestBody('editIngredient')
  @Patch('ingredients/:id')
  editIngredient(@Param('id') id: string, @Body() body: unknown) {
    return this.admin.write(() => this.admin.ingredient(id, body));
  }
  @ApiRequestBody('product')
  @Post('products')
  product(@Body() body: unknown) {
    return this.admin.write(() => this.admin.product(null, body));
  }
  @ApiRequestBody('editProduct')
  @Patch('products/:id')
  editProduct(@Param('id') id: string, @Body() body: unknown) {
    return this.admin.write(() => this.admin.product(id, body));
  }
  @ApiRequestBody('recipe')
  @Patch('sizes/:id/recipe')
  recipe(@Param('id') id: string, @Body() body: unknown) {
    return this.admin.write(() => this.admin.recipe(id, body));
  }
  @ApiRequestBody('promotion')
  @Post('promotions')
  promotion(@Body() body: unknown) {
    return this.admin.write(() => this.admin.promotion(null, body));
  }
  @ApiRequestBody('editPromotion')
  @Patch('promotions/:id')
  editPromotion(@Param('id') id: string, @Body() body: unknown) {
    return this.admin.write(() => this.admin.promotion(id, body));
  }
}
