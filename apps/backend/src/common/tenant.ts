import { ForbiddenException } from '@nestjs/common';
import type { AuthenticatedUser } from '../modules/auth/strategies/jwt.strategy.js';

/** Clinical data is always scoped to the caller's clinic; platform accounts have none. */
export function requireTenantId(user: AuthenticatedUser): string {
    if (!user.tenantId) {
        throw new ForbiddenException('This action requires a clinic account');
    }
    return user.tenantId;
}

/** Escapes LIKE wildcards so user search text matches literally. */
export function escapeLike(text: string): string {
    return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}
