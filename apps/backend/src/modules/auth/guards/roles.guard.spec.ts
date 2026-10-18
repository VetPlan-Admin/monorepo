import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@vet-plan/shared';
import { Public } from '../decorators/public.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { RolesGuard } from './roles.guard.js';

class TestController {
    @Public()
    publicRoute(this: void) { }

    @Roles(Role.CLINIC_ADMIN)
    adminRoute(this: void) { }

    undecoratedRoute(this: void) { }
}

const contextFor = (handler: () => void, user?: { role: Role }): ExecutionContext =>
    ({
        getHandler: () => handler,
        getClass: () => TestController,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

describe('RolesGuard', () => {
    const guard = new RolesGuard(new Reflector());
    const controller = new TestController();

    it('allows @Public() routes without a user', () => {
        expect(guard.canActivate(contextFor(controller.publicRoute))).toBe(true);
    });

    it('denies routes without @Roles() even for authenticated users', () => {
        const context = contextFor(controller.undecoratedRoute, { role: Role.SUPER_ADMIN });
        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('allows a user whose role is listed', () => {
        const context = contextFor(controller.adminRoute, { role: Role.CLINIC_ADMIN });
        expect(guard.canActivate(context)).toBe(true);
    });

    it('denies a user whose role is not listed', () => {
        const context = contextFor(controller.adminRoute, { role: Role.ASSISTANT });
        expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
});
