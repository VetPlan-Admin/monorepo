import { OAuthProvider } from '@vet-plan/shared';
import type { Profile as FacebookProfile } from 'passport-facebook';
import type { Profile as GoogleProfile } from 'passport-google-oauth20';
import { mapFacebookProfile, mapGoogleProfile, mapLinkedInProfile } from './oauth-profile.mappers.js';

describe('OAuth profile mappers', () => {
    it('maps a Google profile and its verified flag', () => {
        const profile = {
            id: 'g-1',
            displayName: 'Ana Vet',
            emails: [{ value: 'ana@example.com', verified: true }],
            photos: [{ value: 'https://example.com/a.png' }],
            _json: {},
        } as unknown as GoogleProfile;

        expect(mapGoogleProfile(profile)).toEqual({
            provider: OAuthProvider.GOOGLE,
            providerUserId: 'g-1',
            email: 'ana@example.com',
            emailVerified: true,
            displayName: 'Ana Vet',
            avatarUrl: 'https://example.com/a.png',
        });
    });

    it('maps LinkedIn OIDC claims and falls back to given/family name', () => {
        expect(
            mapLinkedInProfile({ sub: 'li-1', given_name: 'Bruno', family_name: 'Silva', email: 'b@example.com', email_verified: true }),
        ).toMatchObject({ provider: OAuthProvider.LINKEDIN, providerUserId: 'li-1', displayName: 'Bruno Silva', emailVerified: true, avatarUrl: null });
    });

    it('treats a LinkedIn email without email_verified as unverified', () => {
        expect(mapLinkedInProfile({ sub: 'li-2', email: 'c@example.com' }).emailVerified).toBe(false);
    });

    it('marks a Facebook profile without email as unverified and names it from the email otherwise', () => {
        const withoutEmail = { id: 'fb-1', displayName: 'Carla' } as unknown as FacebookProfile;
        expect(mapFacebookProfile(withoutEmail).emailVerified).toBe(false);

        const nameless = { id: 'fb-2', displayName: '', emails: [{ value: 'dora@example.com' }] } as unknown as FacebookProfile;
        expect(mapFacebookProfile(nameless)).toMatchObject({ emailVerified: true, displayName: 'dora' });
    });
});
