import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {}
