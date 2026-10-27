import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type { TestingModuleBuilder } from '@nestjs/testing';
import type { Role } from '@vet-plan/shared';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';

/** Hermetic config: ConfigModule ignores .env files when NODE_ENV=test (see vitest.config.e2e.ts). */
export const TEST_ENV = {
    JWT_SECRET: 'e2e-test-secret',
    APP_URL: 'http://app.test',
    API_URL: 'http://api.test',
    GOOGLE_CLIENT_ID: 'google-test-client',
    GOOGLE_CLIENT_SECRET: 'google-test-secret',
    // LinkedIn and Facebook deliberately left unconfigured
    LINKEDIN_CLIENT_ID: '',
    LINKEDIN_CLIENT_SECRET: '',
    FACEBOOK_APP_ID: '',
    FACEBOOK_APP_SECRET: '',
} as const;

export interface TestContext {
    app: INestApplication<App>;
    dataSource: DataSource;
    /** Signs an access token for a user that doesn't need to exist in the database. */
    accessTokenFor(role: Role): string;
    close(): Promise<void>;
}

/** Boots the full AppModule against a throwaway in-memory Postgres (PGlite) with migrations applied. */
export async function createTestApp(
    options: { overrides?: (builder: TestingModuleBuilder) => TestingModuleBuilder } = {},
): Promise<TestContext> {
    const db = await PGlite.create();
    const server = new PGLiteSocketServer({ db, port: 0, maxConnections: 10 });
    await server.start();

    Object.assign(process.env, TEST_ENV, {
        DATABASE_URL: `postgres://postgres:postgres@${server.getServerConn()}/postgres`,
    });

    const builder = Test.createTestingModule({ imports: [AppModule] });
    const moduleRef = await (options.overrides?.(builder) ?? builder).compile();
    const app = moduleRef.createNestApplication<INestApplication<App>>();
    configureApp(app);
    await app.init();

    const dataSource = app.get(DataSource);
    await dataSource.runMigrations();
    const jwtService = app.get(JwtService);

    return {
        app,
        dataSource,
        accessTokenFor: (role) => jwtService.sign({ sub: randomUUID(), tenantId: randomUUID(), role, typ: 'access' }),
        close: async () => {
            await app.close();
            await server.stop();
            await db.close();
        },
    };
}
