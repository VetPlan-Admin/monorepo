import { UnauthorizedException } from '@nestjs/common';
import { OAuthProvider, Role } from '@vet-plan/shared';
import type { AccessTokenResponseDto, CurrentUserDto } from '@vet-plan/shared';
import request from 'supertest';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { Tenant } from '../src/modules/tenants/tenant.entity.js';
import { OAuthAccount } from '../src/modules/users/oauth-account.entity.js';
import type { OAuthProfile } from '../src/modules/users/oauth-profile.js';
import type { User } from '../src/modules/users/user.entity.js';
import { UsersService } from '../src/modules/users/users.service.js';
import { createTestApp, TEST_ENV } from './utils/test-app.js';
import type { TestContext } from './utils/test-app.js';

const googleProfile: OAuthProfile = {
    provider: OAuthProvider.GOOGLE,
    providerUserId: 'google-123',
    email: 'Ana.Vet@Example.com',
    emailVerified: true,
    displayName: 'Ana Vet',
    avatarUrl: 'https://example.com/ana.png',
};

describe('Auth (e2e)', () => {
    let ctx: TestContext;
    let usersService: UsersService;
    let authService: AuthService;

    beforeAll(async () => {
        ctx = await createTestApp();
        usersService = ctx.app.get(UsersService);
        authService = ctx.app.get(AuthService);
    });

    afterAll(async () => {
        await ctx.close();
    });

    describe('OAuth redirects', () => {
        it('GET /auth/oauth/google redirects to Google with a state mirrored in a cookie', async () => {
            const res = await request(ctx.app.getHttpServer()).get('/auth/oauth/google').expect(302);

            const location = new URL(res.headers.location as string);
            expect(location.origin + location.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
            expect(location.searchParams.get('client_id')).toBe(TEST_ENV.GOOGLE_CLIENT_ID);
            expect(location.searchParams.get('redirect_uri')).toBe('http://api.test/auth/oauth/google/callback');

            const state = location.searchParams.get('state');
            expect(state).toBeTruthy();
            const cookies = res.headers['set-cookie'] as unknown as string[];
            const stateCookie = cookies.find((c) => c.startsWith('vp_oauth_state='));
            expect(stateCookie).toContain(`vp_oauth_state=${state}`);
            expect(stateCookie).toContain('HttpOnly');
            expect(stateCookie).toContain('Path=/auth/oauth');
        });

        it('sends unconfigured providers back to the login page', async () => {
            const res = await request(ctx.app.getHttpServer()).get('/auth/oauth/linkedin').expect(302);
            expect(res.headers.location).toBe('http://app.test/login?error=provider_unavailable');
        });

        it('sends unknown providers back to the login page', async () => {
            const res = await request(ctx.app.getHttpServer()).get('/auth/oauth/myspace').expect(302);
            expect(res.headers.location).toBe('http://app.test/login?error=provider_unavailable');
        });

        it('rejects a callback whose state does not match the cookie', async () => {
            const res = await request(ctx.app.getHttpServer())
                .get('/auth/oauth/google/callback?code=abc&state=forged')
                .set('Cookie', 'vp_oauth_state=expected')
                .expect(302);
            expect(res.headers.location).toBe('http://app.test/login?error=oauth_failed');
        });
    });

    describe('UsersService.findOrCreateFromOAuth', () => {
        let firstUser: User;

        it('creates a clinic and a CLINIC_ADMIN on first sign-in', async () => {
            firstUser = await usersService.findOrCreateFromOAuth(googleProfile);

            expect(firstUser.email).toBe('ana.vet@example.com');
            expect(firstUser.role).toBe(Role.CLINIC_ADMIN);
            expect(firstUser.tenant?.name).toBe("Ana Vet's Clinic");
            expect(firstUser.lastLoginAt).toBeInstanceOf(Date);
        });

        it('returns the same user for the same provider identity', async () => {
            const again = await usersService.findOrCreateFromOAuth(googleProfile);

            expect(again.id).toBe(firstUser.id);
            expect(await ctx.dataSource.getRepository(Tenant).count()).toBe(1);
        });

        it('links a second provider by verified email', async () => {
            const viaFacebook = await usersService.findOrCreateFromOAuth({
                ...googleProfile,
                provider: OAuthProvider.FACEBOOK,
                providerUserId: 'fb-456',
                email: 'ana.vet@example.com',
            });

            expect(viaFacebook.id).toBe(firstUser.id);
            expect(await ctx.dataSource.getRepository(OAuthAccount).countBy({ userId: firstUser.id })).toBe(2);
        });

        it('refuses unverified emails', async () => {
            await expect(
                usersService.findOrCreateFromOAuth({ ...googleProfile, providerUserId: 'google-999', emailVerified: false }),
            ).rejects.toBeInstanceOf(UnauthorizedException);
        });
    });

    describe('Token exchange & /auth/me', () => {
        let user: User;

        beforeAll(async () => {
            user = await usersService.findOrCreateFromOAuth({
                ...googleProfile,
                providerUserId: 'google-exchange',
                email: 'bruno@example.com',
                displayName: 'Bruno',
            });
        });

        it('swaps an exchange code for an access token that works on /auth/me', async () => {
            const code = authService.issueExchangeCode(user);
            const exchange = await request(ctx.app.getHttpServer()).post('/auth/exchange').send({ code }).expect(200);
            const token = exchange.body as AccessTokenResponseDto;

            expect(token.tokenType).toBe('Bearer');
            expect(token.expiresIn).toBe(24 * 60 * 60);

            const me = await request(ctx.app.getHttpServer())
                .get('/auth/me')
                .set('Authorization', `Bearer ${token.accessToken}`)
                .expect(200);
            const body = me.body as CurrentUserDto;

            expect(body).toMatchObject({ id: user.id, email: 'bruno@example.com', role: Role.CLINIC_ADMIN });
            expect(body.tenant).toEqual({ id: user.tenantId, name: "Bruno's Clinic" });
        });

        it('rejects an access token used as an exchange code', () => {
            const { accessToken } = authService.issueAccessToken(user);
            return request(ctx.app.getHttpServer()).post('/auth/exchange').send({ code: accessToken }).expect(401);
        });

        it('rejects an exchange code used as an access token', () => {
            const code = authService.issueExchangeCode(user);
            return request(ctx.app.getHttpServer()).get('/auth/me').set('Authorization', `Bearer ${code}`).expect(401);
        });

        it('requires a code', () => {
            return request(ctx.app.getHttpServer()).post('/auth/exchange').send({}).expect(400);
        });

        it('GET /auth/me requires a token', () => {
            return request(ctx.app.getHttpServer()).get('/auth/me').expect(401);
        });
    });
});
