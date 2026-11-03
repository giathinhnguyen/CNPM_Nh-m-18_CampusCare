import { Controller, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard.js';

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {}
