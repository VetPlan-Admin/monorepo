import { BadRequestException, Body, Controller, Get, HttpCode, Post, Req, Res, UseFilters, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALL_ROLES } from '@vet-plan/shared';
import type { AccessTokenResponseDto, CurrentUserDto, ExchangeCodeRequestDto } from '@vet-plan/shared';
import type { Request, Response } from 'express';
import type { User } from '../users/user.entity.js';
import { AuthService } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { Roles } from './decorators/roles.decorator.js';
import { OAuthRedirectFilter } from './filters/oauth-redirect.filter.js';
import { OAuthGuard } from './guards/oauth.guard.js';
import type { AuthenticatedUser } from './strategies/jwt.strategy.js';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) { }

    /** Step 1: redirect the browser to the provider's consent screen (done by OAuthGuard). */
    @Public()
    @Get('oauth/:provider')
    @UseGuards(OAuthGuard)
    @UseFilters(OAuthRedirectFilter)
    startOAuth(): void {
        // Unreachable: OAuthGuard always responds with a redirect
    }

    /** Step 2: provider redirects back; hand the frontend a one-minute exchange code. */
    @Public()
    @Get('oauth/:provider/callback')
    @UseGuards(OAuthGuard)
    @UseFilters(OAuthRedirectFilter)
    oauthCallback(@Req() request: Request, @Res() response: Response): void {
        // Set by the provider strategy's validate() → UsersService.findOrCreateFromOAuth
        const user = request.user as User;
        const callbackUrl = new URL('/auth/callback', this.configService.get<string>('APP_URL', 'http://localhost:3000'));
        callbackUrl.searchParams.set('code', this.authService.issueExchangeCode(user));
        response.redirect(302, callbackUrl.toString());
    }

    /** Step 3: the frontend server swaps the code for an access token (server-to-server). */
    @Public()
    @Post('exchange')
    @HttpCode(200)
    exchange(@Body() body: ExchangeCodeRequestDto | undefined): Promise<AccessTokenResponseDto> {
        if (typeof body?.code !== 'string' || body.code.length === 0) {
            throw new BadRequestException('code is required');
        }
        return this.authService.exchangeCode(body.code);
    }

    @Get('me')
    @Roles(...ALL_ROLES)
    me(@CurrentUser() user: AuthenticatedUser): Promise<CurrentUserDto> {
        return this.authService.getCurrentUser(user.userId);
    }
}
