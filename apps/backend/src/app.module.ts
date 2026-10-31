import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AiBotModule } from './modules/ai-bot/ai-bot.module.js';
import { buildDataSourceOptions } from './config/database.config.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CasesModule } from './modules/cases/cases.module.js';
import { PatientsModule } from './modules/patients/patients.module.js';
import { TelemetryModule } from './modules/telemetry/telemetry.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './modules/auth/guards/roles.guard.js';

@Module({
  imports: [
    // ENV_FILE: the secret Cloud Run mounts as a file (docs/DEPLOYMENT.md). Locally: apps/backend/.env,
    // then the monorepo root .env. Already-set variables win. Tests set their own env.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [...(process.env.ENV_FILE ? [process.env.ENV_FILE] : []), '.env', '../../.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildDataSourceOptions(configService.getOrThrow<string>('DATABASE_URL')),
    }),
    AuthModule,
    PatientsModule,
    CasesModule,
    TelemetryModule,
    AiBotModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard, // Runs 1st: Verifies JWT token or allows @Public() routes
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,   // Runs 2nd: Checks permissions set by @Roles(...)
    },
  ],
})
export class AppModule { }
