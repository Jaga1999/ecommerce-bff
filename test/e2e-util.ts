import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppModule } from '../src/app.module';
import { TestEnvironment } from './test-setup';

export async function createTestingModuleWithContainers(
  testEnv: TestEnvironment,
): Promise<TestingModuleBuilder> {
  const envValues = await testEnv.start();

  return Test.createTestingModule({
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
      }),
    );
}
