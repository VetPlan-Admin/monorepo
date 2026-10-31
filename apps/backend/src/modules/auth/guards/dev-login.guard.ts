import { Injectable, NotFoundException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

/** The only NODE_ENV values where dev login can be on. Cloud Run always runs with NODE_ENV=production. */
const DEV_LOGIN_ENVIRONMENTS: ReadonlySet<string> = new Set(['development', 'test']);

/** Dev login needs two switches: DEV_LOGIN_ENABLED=true and a development/test NODE_ENV. */
export function isDevLoginEnabled(configService: ConfigService): boolean {
    return (
        configService.get<string>('DEV_LOGIN_ENABLED') === 'true' &&
        DEV_LOGIN_ENVIRONMENTS.has(configService.get<string>('NODE_ENV') ?? '')
    );
}

/** Hides the dev login routes unless they're enabled: same 404 as a route that doesn't exist. */
@Injectable()
export class DevLoginGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) { }

    canActivate(context: ExecutionContext): boolean {
        if (!isDevLoginEnabled(this.configService)) {
            const request = context.switchToHttp().getRequest<Request>();
            throw new NotFoundException(`Cannot ${request.method} ${request.originalUrl}`);
        }
        return true;
    }
}
