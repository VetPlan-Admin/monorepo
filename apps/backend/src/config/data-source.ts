// TypeORM CLI entry point (`pnpm migration:run`). Nest's ConfigModule isn't running here,
// so load .env from apps/backend and the monorepo root (existing variables win).
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './database.config.js';

for (const file of ['.env', '../../.env']) {
    try {
        process.loadEnvFile(file);
    } catch {
        // File is optional
    }
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
}

export default new DataSource(buildDataSourceOptions(databaseUrl));
