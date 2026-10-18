import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CasesModule } from './modules/cases/cases.module.js';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './modules/auth/guards/roles.guard.js';

@Module({
  imports: [
    // Looks for .env in apps/backend first, then the monorepo root
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env', '../../.env'] }),
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
