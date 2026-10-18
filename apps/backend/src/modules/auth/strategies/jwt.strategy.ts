import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Role } from '@vet-plan/shared';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface JwtPayload {
    sub: string;
    tenantId: string;
    role: Role;
}

export interface AuthenticatedUser {
    userId: string;
    tenantId: string;
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
        return { userId: payload.sub, tenantId: payload.tenantId, role: payload.role };
    }
}
