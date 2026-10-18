import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  // 4000 matches API_URL in .env.example; Next.js uses 3000
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();
