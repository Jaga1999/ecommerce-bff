import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(
  app: INestApplication,
  prefix: string,
  swaggerPrefix: string,
) {
  const config = new DocumentBuilder()
    .setTitle('BFF API Documentation')
    .setDescription('The BFF API for Todo Application')
    .setVersion('1.0')
    .addTag('auth')
    .addTag('users')
    .addTag('todos')
    .addCookieAuth('SESSION_ID')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(`${prefix}/${swaggerPrefix}`, app, document);
}
