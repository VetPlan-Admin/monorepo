import { OAuthProvider } from '@vet-plan/shared';
import type { Profile as FacebookProfile } from 'passport-facebook';
import type { Profile as GoogleProfile } from 'passport-google-oauth20';
import type { OAuthProfile } from '../../users/oauth-profile.js';

/** Claims returned by LinkedIn's OpenID Connect `userinfo` endpoint. */
export interface LinkedInUserInfo {
    sub: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    picture?: string;
    email?: string;
    email_verified?: boolean;
}

function fallbackName(email: string, name?: string): string {
    return name?.trim() || email.split('@')[0] || 'Vet Plan user';
}

export function mapGoogleProfile(profile: GoogleProfile): OAuthProfile {
    const email = profile.emails?.[0]?.value ?? '';
    return {
        provider: OAuthProvider.GOOGLE,
        providerUserId: profile.id,
        email,
        emailVerified: profile.emails?.[0]?.verified === true || profile._json.email_verified === true,
        displayName: fallbackName(email, profile.displayName),
        avatarUrl: profile.photos?.[0]?.value ?? null,
    };
}

export function mapLinkedInProfile(info: LinkedInUserInfo): OAuthProfile {
    const email = info.email ?? '';
    const fullName = info.name ?? [info.given_name, info.family_name].filter(Boolean).join(' ');
    return {
        provider: OAuthProvider.LINKEDIN,
        providerUserId: info.sub,
        email,
        emailVerified: info.email_verified === true,
        displayName: fallbackName(email, fullName),
        avatarUrl: info.picture ?? null,
    };
}

export function mapFacebookProfile(profile: FacebookProfile): OAuthProfile {
    const email = profile.emails?.[0]?.value ?? '';
    return {
        provider: OAuthProvider.FACEBOOK,
        providerUserId: profile.id,
        email,
        // Facebook only returns the `email` field for addresses the user has confirmed
        emailVerified: email.length > 0,
        displayName: fallbackName(email, profile.displayName),
        avatarUrl: profile.photos?.[0]?.value ?? null,
    };
}
