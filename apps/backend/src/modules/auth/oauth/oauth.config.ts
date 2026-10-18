import { NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { OAuthProvider } from '@vet-plan/shared';

const CREDENTIAL_KEYS: Record<OAuthProvider, { id: string; secret: string }> = {
    [OAuthProvider.GOOGLE]: { id: 'GOOGLE_CLIENT_ID', secret: 'GOOGLE_CLIENT_SECRET' },
    [OAuthProvider.LINKEDIN]: { id: 'LINKEDIN_CLIENT_ID', secret: 'LINKEDIN_CLIENT_SECRET' },
    [OAuthProvider.FACEBOOK]: { id: 'FACEBOOK_APP_ID', secret: 'FACEBOOK_APP_SECRET' },
};

// Passport strategies refuse to construct without a client id; unconfigured providers get this
// placeholder and are rejected by OAuthGuard before Passport is ever invoked.
const NOT_CONFIGURED = 'not-configured';

export function parseOAuthProvider(value: string | undefined): OAuthProvider {
    const provider = Object.values(OAuthProvider).find((p) => p === value);
    if (!provider) {
        throw new NotFoundException(`Unknown login provider "${value}"`);
    }
    return provider;
}

export function isOAuthProviderConfigured(config: ConfigService, provider: OAuthProvider): boolean {
    const keys = CREDENTIAL_KEYS[provider];
    return Boolean(config.get<string>(keys.id) && config.get<string>(keys.secret));
}

export function oauthStrategyOptions(config: ConfigService, provider: OAuthProvider) {
    const keys = CREDENTIAL_KEYS[provider];
    const apiUrl = config.get<string>('API_URL', 'http://localhost:4000');
    return {
        clientID: config.get<string>(keys.id) || NOT_CONFIGURED,
        clientSecret: config.get<string>(keys.secret) || NOT_CONFIGURED,
        callbackURL: new URL(`/auth/oauth/${provider}/callback`, apiUrl).toString(),
    };
}
