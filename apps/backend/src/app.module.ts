import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { buildDataSourceOptions } from './config/database.config.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CasesModule } from './modules/cases/cases.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './modules/auth/guards/roles.guard.js';

@Module({
  imports: [
    // Looks for .env in apps/backend first, then the monorepo root. Tests set their own env.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildDataSourceOptions(configService.getOrThrow<string>('DATABASE_URL')),
    }),
    AuthModule,
    CasesModule,
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
