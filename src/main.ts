import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, LogLevel, Logger } from '@nestjs/common';
import { AppProperties } from './config/properties/app.properties';
import { DatabaseProperties } from './config/properties/db.properties';
import { KeycloakProperties } from './config/properties/keycloak.properties';
import { RedisProperties } from './config/properties/redis.properties';
import { SessionProperties } from './config/properties/session.properties';
import { GoogleProperties } from './config/properties/google.properties';
import { setupSwagger } from './config/swagger.config';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { MigrationService } from './database/migration.service';
import cookieParser from 'cookie-parser';
import { Request, Response, NextFunction } from 'express';

declare module 'express' {
  interface Request {
    startTime?: number;
  }
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  // Ensure all configuration properties are validated on startup
  const appProps = app.get(AppProperties);
  app.get(DatabaseProperties);
  app.get(KeycloakProperties);
  app.get(RedisProperties);
  app.get(SessionProperties);
  app.get(GoogleProperties);
  const isProduction = appProps.nodeEnv === 'production';
  const loggerLevels: LogLevel[] = isProduction
    ? ['log', 'error', 'warn', 'fatal']
    : ['log', 'error', 'warn', 'debug', 'verbose', 'fatal'];

  app.useLogger(loggerLevels);

  const port = appProps.port;
  const prefix = 'api';

  app.setGlobalPrefix(prefix);
  app.use(cookieParser());

  // Performance monitoring middleware
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.startTime = Date.now();
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  setupSwagger(app, prefix);

  // Run migrations manually with detailed logging if enabled in properties
  const dbProps = app.get(DatabaseProperties);
  if (dbProps.migrationsRun) {
    const migrationService = app.get(MigrationService);
    await migrationService.runMigrations();
  } else {
    logger.log('Database migrations are disabled via configuration.');
  }

  await app.listen(port);
  console.log(
    `BFF application is running on: http://localhost:${port}/${prefix}`,
  );
}
bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
