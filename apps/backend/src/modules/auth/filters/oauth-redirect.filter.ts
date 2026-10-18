import { Catch, Logger, NotFoundException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

/** Browser-facing OAuth routes never show JSON errors: send the user back to the login page. */
@Catch()
export class OAuthRedirectFilter implements ExceptionFilter {
    private readonly logger = new Logger(OAuthRedirectFilter.name);

    constructor(private readonly configService: ConfigService) { }

    catch(exception: unknown, host: ArgumentsHost): void {
        const response = host.switchToHttp().getResponse<Response>();
        const reason = exception instanceof NotFoundException ? 'provider_unavailable' : 'oauth_failed';
        this.logger.warn(`OAuth sign-in failed: ${exception instanceof Error ? exception.message : String(exception)}`);

        const loginUrl = new URL('/login', this.configService.get<string>('APP_URL', 'http://localhost:3000'));
        loginUrl.searchParams.set('error', reason);
        response.redirect(302, loginUrl.toString());
    }
}
