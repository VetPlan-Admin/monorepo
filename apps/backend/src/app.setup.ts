import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';

/** Express middleware shared by main.ts and the e2e tests. */
export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);

  app.use(cookieParser());

  // Shared screens (@vet-plan/app) call the API from the browser. Only the web app's origin(s) are
  // allowed; native apps don't send Origin. Tokens travel as Bearer headers, never cookies.
  app.enableCors({
    // An array (not a bare string) makes `cors` echo the header only for matching origins
    origin: [configService.get<string>('APP_URL', 'http://localhost:3000')],
    credentials: false,
  });
}
