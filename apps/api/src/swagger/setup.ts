import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('BrewLite API')
    .setDescription(
      'Môi trường thử API phát triển. Bắt đầu với GET /api/products, sau đó POST /api/auth/login. ' +
        'Sao chép accessToken vào Authorize (chỉ token, không thêm Bearer). ' +
        'Các UUID mẫu cần thay bằng ID thật từ response. Execute gửi request thật và có thể thay đổi dữ liệu. ' +
        'Đọc hướng dẫn tại docs/api/SWAGGER.md.',
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: {
      persistAuthorization: false,
      tagsSorter: 'alpha',
      docExpansion: 'none',
    },
  });
}
