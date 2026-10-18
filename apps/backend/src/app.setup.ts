import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/** Express middleware shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication): void {
  app.use(cookieParser());
}
