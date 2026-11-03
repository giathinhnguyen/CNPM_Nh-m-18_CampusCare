import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { PromotionsService } from './promotions.service.js';

@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  findAll() {
    return this.promotionsService.findAll();
  }

  @Post('quote')
  @HttpCode(200)
  quote(@Body() body: unknown) {
    return this.promotionsService.quote(body);
  }
}
