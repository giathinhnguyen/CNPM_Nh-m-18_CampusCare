import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthGuard } from './auth.guard.js';
import { VerificationMailService } from './verification-mail.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordSetupService } from './password-setup.service.js';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;

        if (!secret) {
          throw new Error('Chưa cấu hình JWT_SECRET.');
        }

        return {
          secret,
          signOptions: {
            expiresIn: '1h',
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, VerificationMailService, EmailVerificationService, PasswordSetupService],
  exports: [AuthGuard, JwtModule],
})
export class AuthModule {}
