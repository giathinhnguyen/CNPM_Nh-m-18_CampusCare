import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port, '0.0.0.0');
}

bootstrap();
