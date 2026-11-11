import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupSwagger } from './swagger/setup.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Tiền tố chung cho các API
  app.setGlobalPrefix('api');
  if (process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true') setupSwagger(app);

  // Cho phép frontend React gọi API
  app.enableCors({
    origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  });

  // Cổng chạy backend
  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
