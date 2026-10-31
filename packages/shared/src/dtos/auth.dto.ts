import type { Role } from '../enums/roles.enum.js';

/** Body of `POST /auth/exchange`: the one-minute code from the OAuth callback redirect. */
export interface ExchangeCodeRequestDto {
    code: string;
}

/** Response of `POST /auth/exchange`. */
export interface AccessTokenResponseDto {
    accessToken: string;
    tokenType: 'Bearer';
    /** Lifetime in seconds. Web uses it as the session cookie `maxAge`. */
    expiresIn: number;
}

/** Response of `GET /auth/me`. */
export interface CurrentUserDto {
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    role: Role;
    tenant: { id: string; name: string } | null;
}

/**
 * Response of `GET /auth/dev/roles`: the roles the local development sign-in offers.
 * The endpoint answers 404 unless dev login is switched on, and never in production.
 */
export interface DevLoginOptionsDto {
    roles: Role[];
}
