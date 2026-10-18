import { InternalOAuthError, Strategy as OAuth2Strategy } from 'passport-oauth2';
import type { StrategyOptions, VerifyFunction } from 'passport-oauth2';
import type { LinkedInUserInfo } from './oauth-profile.mappers.js';

const AUTHORIZATION_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

/**
 * "Sign In with LinkedIn using OpenID Connect". `passport-linkedin-oauth2` still targets the
 * retired `r_liteprofile` API, which new LinkedIn apps cannot request.
 */
export class LinkedInOidcStrategy extends OAuth2Strategy {
    constructor(options: Omit<StrategyOptions, 'authorizationURL' | 'tokenURL'>, verify: VerifyFunction) {
        super(
            { scope: ['openid', 'profile', 'email'], ...options, authorizationURL: AUTHORIZATION_URL, tokenURL: TOKEN_URL },
            verify,
        );
        this.name = 'linkedin';
    }

    override userProfile(accessToken: string, done: (err?: unknown, profile?: LinkedInUserInfo) => void): void {
        fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } })
            .then(async (response) => {
                if (!response.ok) {
                    throw new InternalOAuthError(`LinkedIn userinfo request failed (${response.status})`, undefined);
                }
                done(null, (await response.json()) as LinkedInUserInfo);
            })
            .catch((err: unknown) => done(err));
    }
}
