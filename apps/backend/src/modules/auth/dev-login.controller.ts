import { BadRequestException, Controller, Get, Logger, Param, Res, UseGuards } from '@nestjs/common';
import type { OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ALL_ROLES } from '@vet-plan/shared';
import type { DevLoginOptionsDto, Role } from '@vet-plan/shared';
import type { Response } from 'express';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';
import { Public } from './decorators/public.decorator.js';
import { DevLoginGuard, isDevLoginEnabled } from './guards/dev-login.guard.js';

function isRole(value: string): value is Role {
    return (ALL_ROLES as readonly string[]).includes(value);
}

/**
 * Local development sign-in without an OAuth provider (docs/ARCHITECTURE.md §1.1).
 * Off unless DEV_LOGIN_ENABLED=true and NODE_ENV is development/test; otherwise every route is a 404.
 */
@Controller('auth/dev')
@Public()
@UseGuards(DevLoginGuard)
export class DevLoginController implements OnApplicationBootstrap {
    private readonly logger = new Logger(DevLoginController.name);

    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
        private readonly configService: ConfigService,
    ) { }

    onApplicationBootstrap(): void {
        if (isDevLoginEnabled(this.configService)) {
            this.logger.warn('Dev login is ON: anyone who can reach this API can sign in with any role. Local use only.');
        }
    }

    /** Roles offered on the login page. The web app hides the section when this answers 404. */
    @Get('roles')
    roles(): DevLoginOptionsDto {
        return { roles: [...ALL_ROLES] };
    }

    /** Signs in as the fixed dev user of a role and continues exactly like an OAuth callback. */
    @Get('login/:role')
    async login(@Param('role') role: string, @Res() response: Response): Promise<void> {
        if (!isRole(role)) {
            throw new BadRequestException(`role must be one of ${ALL_ROLES.join(', ')}`);
        }
        const user = await this.usersService.findOrCreateDevUser(role);
        response.redirect(302, this.authService.webCallbackUrl(user));
    }
}
