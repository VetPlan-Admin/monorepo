import type { DataSourceOptions } from 'typeorm';
import { InitialSchema1792294241885 } from '../migrations/1792294241885-InitialSchema.js';
import { AddPatientsCasesAndPlans1792354428247 } from '../migrations/1792354428247-AddPatientsCasesAndPlans.js';
import { RadiographPlan } from '../modules/cases/radiograph-plan.entity.js';
import { SurgicalCase } from '../modules/cases/surgical-case.entity.js';
import { Patient } from '../modules/patients/patient.entity.js';
import { Tenant } from '../modules/tenants/tenant.entity.js';
import { OAuthAccount } from '../modules/users/oauth-account.entity.js';
import { User } from '../modules/users/user.entity.js';

export const ENTITIES = [Tenant, User, OAuthAccount, Patient, SurgicalCase, RadiographPlan];

// Register every new migration here (explicit imports work in both `dist/` and Vitest)
export const MIGRATIONS = [InitialSchema1792294241885, AddPatientsCasesAndPlans1792354428247];

/**
 * Shared by the Nest app and the TypeORM CLI. Neon connection strings carry
 * `?sslmode=require`, which node-postgres honours, so SSL needs no extra config.
 */
export function buildDataSourceOptions(databaseUrl: string): DataSourceOptions {
    return {
        type: 'postgres',
        url: databaseUrl,
        entities: ENTITIES,
        migrations: MIGRATIONS,
        synchronize: false,
        // gen_random_uuid() is built into Postgres 13+ (Neon, PGlite); no uuid-ossp needed
        uuidExtension: 'pgcrypto',
        migrationsTableName: 'typeorm_migrations',
    };
}
