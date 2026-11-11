import {
  ApiTags,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiRequestBody } from '../swagger/request-bodies.js';
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import type { AuthenticatedRequest } from './auth.guard.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordSetupService } from './password-setup.service.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly verification: EmailVerificationService,
    private readonly passwordSetup: PasswordSetupService,
  ) {}

  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  @Post('password-setup/request')
  requestPasswordSetup(@Req() request: AuthenticatedRequest) {
    return this.passwordSetup.requestCode(request.user.id);
  }

  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  @ApiRequestBody('passwordSetup')
  @Post('password-setup/confirm')
  confirmPasswordSetup(
    @Req() request: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    return this.passwordSetup.setPassword(request.user.id, body);
  }

  @ApiRequestBody('verifyEmail')
  @Post('verify-email')
  verifyEmail(@Body() body: unknown) {
    return this.verification.verify(body);
  }

  @ApiRequestBody('resendVerification')
  @Post('resend-verification')
  resendVerification(@Body() body: unknown) {
    return this.verification.resend(body);
  }

  @ApiRequestBody('login')
  @Post('login')
  login(@Body() body: unknown) {
    return this.authService.login(body);
  }
  @ApiRequestBody('google')
  @Post('google')
  googleLogin(@Body() body: unknown) {
    return this.authService.googleLogin(body);
  }

  @ApiBearerAuth()
  @ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
  @UseGuards(AuthGuard)
  @Get('me')
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    return this.authService.getCurrentUser(request.user.id);
  }

  @ApiRequestBody('register')
  @Post('register')
  register(@Body() body: unknown) {
    return this.authService.register(body);
  }
}
