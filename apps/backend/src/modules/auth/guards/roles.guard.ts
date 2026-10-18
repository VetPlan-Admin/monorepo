import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@vet-plan/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const targets = [context.getHandler(), context.getClass()];

        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets);
        if (isPublic) {
            return true;
        }

        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);

        // Deny by default: every non-public route must declare @Roles(...)
        if (!requiredRoles || requiredRoles.length === 0) {
            throw new ForbiddenException('Route has no @Roles() declaration');
        }

        const { user } = context.switchToHttp().getRequest();
        if (!user || !user.role) {
            throw new ForbiddenException('User context or role missing');
        }

        const hasRole = requiredRoles.includes(user.role);
        if (!hasRole) {
            throw new ForbiddenException('Insufficient permissions for this operation');
        }

        return true;
    }
}
