import type { OAuthProvider } from '@vet-plan/shared';

/** Provider-neutral identity produced by each OAuth strategy. */
export interface OAuthProfile {
    provider: OAuthProvider;
    providerUserId: string;
    email: string;
    /** Only verified emails may create or link accounts (prevents takeover via unverified addresses). */
    emailVerified: boolean;
    displayName: string;
    avatarUrl: string | null;
}
