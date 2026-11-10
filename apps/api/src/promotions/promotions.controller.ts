import { ApiTags } from '@nestjs/swagger';
import { ApiRequestBody } from '../swagger/request-bodies.js';
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { PromotionsService } from './promotions.service.js';

@ApiTags('promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  findAll() {
    return this.promotionsService.findAll();
  }

  @ApiRequestBody('promotionQuote')
  @Post('quote')
  @HttpCode(200)
  quote(@Body() body: unknown) {
    return this.promotionsService.quote(body);
  }
}
