import {
  ApiTags,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiRequestBody } from '../swagger/request-bodies.js';
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { RewardsService } from './rewards.service.js';
import { AuthGuard, type AuthenticatedRequest } from '../auth/auth.guard.js';

@ApiTags('rewards')
@Controller('rewards')
export class RewardsController {
  constructor(private readonly rewardsService: RewardsService) {}

  @Get('products')
  getProducts() {
    return this.rewardsService.getActiveRewardProducts();
  }

  @Get('balance')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  getBalance(@Req() req: AuthenticatedRequest) {
    return this.rewardsService.getBalance(req.user.id);
  }

  @ApiRequestBody('redeem')
  @Post('redeem')
  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  redeem(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    return this.rewardsService.redeem(req.user.id, body);
  }
}
