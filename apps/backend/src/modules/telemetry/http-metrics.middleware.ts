import type { NextFunction, Request, Response } from 'express';
import { httpServerDuration } from './metrics.js';

/**
 * Records every response (including guard rejections and 404s, which interceptors never see)
 * once it has been sent. Express sets `req.route` during routing, so the template is known here.
 */
export function httpMetricsMiddleware(request: Request, response: Response, next: NextFunction): void {
    const start = performance.now();
    response.on('finish', () => {
        const route = request.route as { path?: string } | undefined;
        httpServerDuration.record((performance.now() - start) / 1000, {
            'http.request.method': request.method,
            'http.route': route?.path ? `${request.baseUrl}${route.path}` : 'unmatched',
            'http.response.status_code': response.statusCode,
        });
    });
    next();
}
