import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import { createAppLogger } from './modules/telemetry/app-logger.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: createAppLogger() });
  configureApp(app);
  // Cloud Run sends SIGTERM before stopping an instance: flush pending logs, close the DB pool
  app.enableShutdownHooks();
  // 4000 matches API_URL in .env.example; Next.js uses 3000
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
