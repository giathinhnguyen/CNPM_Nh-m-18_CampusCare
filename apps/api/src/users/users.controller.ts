import {
  ApiTags,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';

@ApiTags('users')
@Controller('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'JWT required, invalid or expired.' })
@UseGuards(AuthGuard)
export class UsersController {}
