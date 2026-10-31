// TypeORM CLI entry point (`pnpm migration:run`, Cloud Run migration job). Nest's ConfigModule isn't
// running here, so load ENV_FILE (the mounted secret) or the local .env files (existing variables win).
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.config.js';

for (const file of [...(process.env.ENV_FILE ? [process.env.ENV_FILE] : []), '.env', '../../.env']) {
    try {
        process.loadEnvFile(file);
    } catch {
        // File is optional
    }
}

// Migrations should use a direct (non-pooled) connection: Neon's pooler runs PgBouncer in
// transaction mode, which migration tooling may not support. The app itself uses DATABASE_URL.
const databaseUrl = process.env.DATABASE_MIGRATION_URL || process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('Set DATABASE_MIGRATION_URL (direct connection) or DATABASE_URL');
}

export default new DataSource(buildDataSourceOptions(databaseUrl));
