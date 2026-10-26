import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import type { AuthenticatedRequest } from './auth.guard.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordSetupService } from './password-setup.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly verification: EmailVerificationService, private readonly passwordSetup: PasswordSetupService) {}

  @UseGuards(AuthGuard)
  @Post('password-setup/request')
  requestPasswordSetup(@Req() request: AuthenticatedRequest) {
    return this.passwordSetup.requestCode(request.user.id);
  }

  @UseGuards(AuthGuard)
  @Post('password-setup/confirm')
  confirmPasswordSetup(@Req() request: AuthenticatedRequest, @Body() body: unknown) {
    return this.passwordSetup.setPassword(request.user.id, body);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: unknown) { return this.verification.verify(body); }

  @Post('resend-verification')
  resendVerification(@Body() body: unknown) { return this.verification.resend(body); }

  @Post('login')
  login(@Body() body: unknown) {
    return this.authService.login(body);
  }
  @Post('google')
  googleLogin(@Body() body: unknown) {
    return this.authService.googleLogin(body);
  }
  
  @UseGuards(AuthGuard)
  @Get('me')
  getCurrentUser(@Req() request: AuthenticatedRequest) {
    return this.authService.getCurrentUser(request.user.id);
  }

  @Post('register')
  register(@Body() body: unknown) {
    return this.authService.register(body);
  }
}
