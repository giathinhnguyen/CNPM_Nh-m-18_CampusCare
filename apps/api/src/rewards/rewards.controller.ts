import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { RewardsService } from './rewards.service.js';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';

@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('products')
  getProducts() {
    return this.rewardsService.getActiveRewardProducts();
  }

  @Get('balance')
  @UseGuards(AuthGuard)
  getBalance(@Req() req: AuthenticatedRequest) {
    return this.rewardsService.getBalance(req.user.id);
  }

  @Post('redeem')
  @UseGuards(AuthGuard)
  redeem(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.rewardsService.redeem(req.user.id, body);
  }
}
