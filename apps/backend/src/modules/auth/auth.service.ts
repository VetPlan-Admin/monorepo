import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AccessTokenResponseDto, CurrentUserDto } from '@vet-plan/shared';
import type { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import type { JwtPayload } from './strategies/jwt.strategy.js';

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const EXCHANGE_CODE_TTL_SECONDS = 60;

interface ExchangeCodePayload {
    sub: string;
    typ: 'exchange';
}

@Injectable()
export class AuthService {
    private readonly accessTokenTtl: number;

    constructor(
        private readonly jwtService: JwtService,
        private readonly usersService: UsersService,
        configService: ConfigService,
    ) {
        const ttl = Number(configService.get<string>('JWT_EXPIRES_IN'));
        this.accessTokenTtl = Number.isInteger(ttl) && ttl > 0 ? ttl : DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
    }

    issueAccessToken(user: User): AccessTokenResponseDto {
        const payload: JwtPayload = { sub: user.id, tenantId: user.tenantId, role: user.role, typ: 'access' };
        return {
            accessToken: this.jwtService.sign(payload, { expiresIn: this.accessTokenTtl }),
            tokenType: 'Bearer',
            expiresIn: this.accessTokenTtl,
        };
    }

    /**
     * Short-lived code put in the OAuth redirect URL instead of the access token itself.
     * The frontend server swaps it via `POST /auth/exchange` and stores the token in an HTTP-only cookie.
     */
    issueExchangeCode(user: User): string {
        const payload: ExchangeCodePayload = { sub: user.id, typ: 'exchange' };
        return this.jwtService.sign(payload, { expiresIn: EXCHANGE_CODE_TTL_SECONDS });
    }

    async exchangeCode(code: string): Promise<AccessTokenResponseDto> {
        let payload: ExchangeCodePayload;
        try {
            payload = await this.jwtService.verifyAsync<ExchangeCodePayload>(code);
        } catch {
            throw new UnauthorizedException('Invalid or expired code');
        }
        if (payload.typ !== 'exchange') {
            throw new UnauthorizedException('Invalid or expired code');
        }

        // Re-read the user so the token carries the current role and tenant
        const user = await this.usersService.findById(payload.sub);
        if (!user) {
            throw new UnauthorizedException('Invalid or expired code');
        }
        return this.issueAccessToken(user);
    }

    async getCurrentUser(userId: string): Promise<CurrentUserDto> {
        const user = await this.usersService.findById(userId);
        if (!user) {
            throw new UnauthorizedException('User no longer exists');
        }
        return {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            role: user.role,
            tenant: user.tenant ? { id: user.tenant.id, name: user.tenant.name } : null,
        };
    }
}
