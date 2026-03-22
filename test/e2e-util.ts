import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { TestEnvironment, TestEnvValues } from './test-setup';
import { MigrationService } from '../src/database/migration.service';
import cookieParser from 'cookie-parser';

export async function createAppWithContainers(
  testEnv: TestEnvironment,
): Promise<INestApplication> {
  let envValues: TestEnvValues;
  if (process.env.TEST_DB_HOST) {
    // Containers already started by global setup
    envValues = {
      db: {
        host: process.env.TEST_DB_HOST,
        port: parseInt(process.env.TEST_DB_PORT || '5432'),
        name: process.env.TEST_DB_NAME || 'ecommerce_app_test',
        user: process.env.TEST_DB_USER || 'ecommerce',
        pass: process.env.TEST_DB_PASS || 'change_me',
      },
      redis: {
        host: process.env.TEST_REDIS_HOST || 'localhost',
        port: parseInt(process.env.TEST_REDIS_PORT || '6379'),
      },
      keycloak: {
        url: process.env.TEST_KEYCLOAK_URL || '',
        adminUser: process.env.TEST_KEYCLOAK_ADMIN_USER || 'admin',
        adminPass: process.env.TEST_KEYCLOAK_ADMIN_PASS || 'admin',
      },
    };
    console.log('Using persistent test containers...');
  } else {
    // Fallback to starting new containers (per-test-file)
    envValues = await testEnv.start();
  }

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ConfigService)
    .useValue(
      new ConfigService({
        ...process.env,
        NODE_ENV: 'test',
        APP_DB_HOST: envValues.db.host,
        APP_DB_PORT: envValues.db.port,
        APP_DB_NAME: envValues.db.name,
        APP_DB_USER: envValues.db.user,
        APP_DB_PASSWORD: envValues.db.pass,
        REDIS_HOST: envValues.redis.host,
        REDIS_PORT: envValues.redis.port,
        APP_KEYCLOAK_SERVER_URL: envValues.keycloak.url,
        KC_EXTERNAL_URL: envValues.keycloak.url,
        KC_ADMIN_USER: envValues.keycloak.adminUser,
        KC_ADMIN_PASSWORD: envValues.keycloak.adminPass,
        DB_MIGRATIONS_RUN: 'true',
        BFF_CONTEXT_PATH: 'api',
        SWAGGER_PATH: 'docs',
      }),
    )
    .compile();

  const app = moduleFixture.createNestApplication();

  const prefix = 'api';
  app.setGlobalPrefix(prefix);
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  // Run migrations
  const migrationService = app.get(MigrationService);
  await migrationService.runMigrations();

  return app;
}
