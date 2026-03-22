import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';

import { TestEnvironment } from './test-setup';
import { createTestingModuleWithContainers } from './e2e-util';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let testEnv: TestEnvironment;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    const moduleBuilder = await createTestingModuleWithContainers(testEnv);
    const moduleFixture = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();

    // Mimic main.ts setup
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  }, 120000);

  afterAll(async () => {
    if (app) {
      const cacheManager = app.get<Cache>(CACHE_MANAGER);
      const redisStore = cacheManager as unknown as {
        store?: {
          client?: { isOpen?: boolean; disconnect: () => Promise<void> };
        };
      };
      const client = redisStore.store?.client;
      if (client && client.isOpen) {
        await client.disconnect();
      }
      await app.close();
    }
    if (testEnv) {
      await testEnv.stop();
    }
  });

  it('/api (GET) should return Hello World!', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });
});
