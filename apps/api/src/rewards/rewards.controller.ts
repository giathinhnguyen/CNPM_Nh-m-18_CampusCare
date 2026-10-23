import { Controller, Get } from '@nestjs/common';
import { RewardsService } from './rewards.service.js';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('products')
  getProducts() {
    return this.rewardsService.getActiveRewardProducts();
  }
}
