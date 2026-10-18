import { randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { CookieOptions, Request, Response } from 'express';
import { isOAuthProviderConfigured, parseOAuthProvider } from '../oauth/oauth.config.js';

const STATE_COOKIE = 'vp_oauth_state';
const STATE_TTL_MS = 10 * 60 * 1000;

/**
 * Runs the Passport strategy named by the `:provider` route param and protects the
 * round trip against login CSRF with a `state` value mirrored in an HTTP-only cookie
 * (stateless, so it works across Cloud Run instances without sessions).
 */
@Injectable()
export class OAuthGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const http = context.switchToHttp();
        const request = http.getRequest<Request>();
        const response = http.getResponse<Response>();

        const rawProvider = request.params.provider;
        const provider = parseOAuthProvider(typeof rawProvider === 'string' ? rawProvider : undefined);
        if (!isOAuthProviderConfigured(this.configService, provider)) {
            throw new NotFoundException(`${provider} login is not configured`);
        }

        const cookieOptions: CookieOptions = {
            httpOnly: true,
            sameSite: 'lax', // sent on the provider's top-level redirect back to us
            secure: this.configService.get<string>('NODE_ENV') === 'production',
            path: '/auth/oauth',
        };

        let state: string | undefined;
        if (request.path.endsWith('/callback')) {
            this.verifyState(request);
            response.clearCookie(STATE_COOKIE, cookieOptions);
        } else {
            state = randomBytes(32).toString('base64url');
            response.cookie(STATE_COOKIE, state, { ...cookieOptions, maxAge: STATE_TTL_MS });
        }

        const PassportGuard = AuthGuard(provider);
        const guard = new PassportGuard({ session: false, state });
        return (await guard.canActivate(context)) as boolean;
    }

    private verifyState(request: Request): void {
        const cookies = request.cookies as Record<string, string | undefined> | undefined;
        const expected = cookies?.[STATE_COOKIE];
        const received = request.query.state;
        if (
            typeof expected !== 'string' ||
            typeof received !== 'string' ||
            expected.length !== received.length ||
            !timingSafeEqual(Buffer.from(expected), Buffer.from(received))
        ) {
            throw new UnauthorizedException('Invalid OAuth state');
        }
    }
}
