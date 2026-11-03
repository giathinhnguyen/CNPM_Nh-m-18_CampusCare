import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';

@Controller('payments')
@UseGuards(AuthGuard)
export class PaymentsController {}
