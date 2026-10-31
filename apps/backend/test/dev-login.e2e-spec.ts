import { ALL_ROLES, Role } from '@vet-plan/shared';
import type { AccessTokenResponseDto, CurrentUserDto, DevLoginOptionsDto } from '@vet-plan/shared';
import request from 'supertest';
import { DEV_TENANT_NAME } from '../src/modules/users/users.service.js';
import { createTestApp } from './utils/test-app.js';
import type { TestContext } from './utils/test-app.js';

describe('Dev login (e2e)', () => {
    let ctx: TestContext;

    beforeAll(async () => {
        ctx = await createTestApp();
    });

    afterAll(async () => {
        delete process.env.DEV_LOGIN_ENABLED;
        process.env.NODE_ENV = 'test';
        await ctx.close();
    });

    /** Follows the dev login redirect through the code exchange, like the web app's /auth/callback. */
    async function signInAs(role: Role): Promise<CurrentUserDto> {
        const login = await request(ctx.app.getHttpServer()).get(`/auth/dev/login/${role}`).expect(302);
        const location = new URL(login.headers.location as string);
        expect(location.origin + location.pathname).toBe('http://app.test/auth/callback');

        const exchange = await request(ctx.app.getHttpServer())
            .post('/auth/exchange')
            .send({ code: location.searchParams.get('code') })
            .expect(200);
        const { accessToken } = exchange.body as AccessTokenResponseDto;

        const me = await request(ctx.app.getHttpServer())
            .get('/auth/me')
            .set('Authorization', `Bearer ${accessToken}`)
            .expect(200);
        return me.body as CurrentUserDto;
    }

    describe('switched off', () => {
        it.each([
            ['flag unset', undefined, 'test'],
            ['flag not exactly "true"', '1', 'test'],
            ['production, even with the flag', 'true', 'production'],
            ['NODE_ENV unset, even with the flag', 'true', undefined],
        ])('answers 404 like a missing route (%s)', async (_case, flag, nodeEnv) => {
            if (flag === undefined) delete process.env.DEV_LOGIN_ENABLED;
            else process.env.DEV_LOGIN_ENABLED = flag;
            if (nodeEnv === undefined) delete process.env.NODE_ENV;
            else process.env.NODE_ENV = nodeEnv;

            const roles = await request(ctx.app.getHttpServer()).get('/auth/dev/roles').expect(404);
            expect(roles.body).toEqual({ message: 'Cannot GET /auth/dev/roles', error: 'Not Found', statusCode: 404 });
            await request(ctx.app.getHttpServer()).get(`/auth/dev/login/${Role.CLINIC_ADMIN}`).expect(404);
        });

        it('created no users while off', async () => {
            const count = await ctx.dataSource.query<{ count: string }[]>(
                `SELECT count(*) FROM users WHERE email LIKE '%@vetplan.invalid'`,
            );
            expect(count[0].count).toBe('0');
        });
    });

    describe('switched on (DEV_LOGIN_ENABLED=true, NODE_ENV=test)', () => {
        beforeAll(() => {
            process.env.NODE_ENV = 'test';
            process.env.DEV_LOGIN_ENABLED = 'true';
        });

        it('lists every role', async () => {
            const res = await request(ctx.app.getHttpServer()).get('/auth/dev/roles').expect(200);
            expect(res.body).toEqual({ roles: [...ALL_ROLES] } satisfies DevLoginOptionsDto);
        });

        it('signs in through the normal code exchange and reuses the same user', async () => {
            const first = await signInAs(Role.VETERINARIAN);
            expect(first).toMatchObject({
                email: 'dev-veterinarian@vetplan.invalid',
                role: Role.VETERINARIAN,
                tenant: { name: DEV_TENANT_NAME },
            });
            const again = await signInAs(Role.VETERINARIAN);
            expect(again.id).toBe(first.id);
        });

        it('puts every clinic role in the same dev clinic and SUPER_ADMIN in none', async () => {
            const vet = await signInAs(Role.VETERINARIAN);
            const admin = await signInAs(Role.CLINIC_ADMIN);
            const assistant = await signInAs(Role.ASSISTANT);
            expect(admin.tenant?.id).toBe(vet.tenant?.id);
            expect(assistant.tenant?.id).toBe(vet.tenant?.id);

            const superAdmin = await signInAs(Role.SUPER_ADMIN);
            expect(superAdmin).toMatchObject({ role: Role.SUPER_ADMIN, tenant: null });
        });

        it('rejects unknown roles', async () => {
            await request(ctx.app.getHttpServer()).get('/auth/dev/login/OWNER').expect(400);
        });
    });
});
