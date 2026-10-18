import { Controller, Get } from '@nestjs/common';
import type { HealthResponseDto } from '@vet-plan/shared';
import { Public } from './modules/auth/decorators/public.decorator.js';

@Controller()
export class AppController {
  @Public() // Bypasses JWT check so health checks return 200 OK
  @Get('health')
  getHealth(): HealthResponseDto {
    return { status: 'ok' };
  }
}
