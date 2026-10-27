import { timingSafeEqual } from 'node:crypto';
import { Controller, Get, NotFoundException, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { Public } from '../auth/decorators/public.decorator.js';
import { prometheusExporter } from './metrics.js';

function safeEqual(a: string, b: string): boolean {
    return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

@Controller('metrics')
export class MetricsController {
    constructor(private readonly configService: ConfigService) { }

    /**
     * Prometheus text format. Protected by `METRICS_TOKEN` (bearer) when set; without a token the
     * endpoint is only served outside production.
     */
    @Public()
    @Get()
    metrics(@Req() request: Request, @Res() response: Response): void {
        const token = this.configService.get<string>('METRICS_TOKEN');
        if (!token) {
            if (this.configService.get<string>('NODE_ENV') === 'production') {
                throw new NotFoundException();
            }
        } else if (!safeEqual(request.headers.authorization ?? '', `Bearer ${token}`)) {
            throw new UnauthorizedException();
        }
        prometheusExporter.getMetricsRequestHandler(request, response);
    }
}
