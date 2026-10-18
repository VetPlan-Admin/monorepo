import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Role } from '@vet-plan/shared';
import { ExtractJwt, Strategy } from 'passport-jwt';

/** Claims of an access token. `typ` keeps short-lived exchange codes from working as access tokens. */
export interface JwtPayload {
    sub: string;
    tenantId: string | null;
    role: Role;
    typ: 'access';
}

export interface AuthenticatedUser {
    userId: string;
    tenantId: string | null;
    role: Role;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
        });
    }

    // Return value is attached to request.user and consumed by RolesGuard
    validate(payload: JwtPayload): AuthenticatedUser {
        if (payload.typ !== 'access') {
            throw new UnauthorizedException('Not an access token');
        }
        return { userId: payload.sub, tenantId: payload.tenantId, role: payload.role };
    }
}
