import { INestApplication } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import request from 'supertest';
import { App as SupertestApp } from 'supertest/types';
import { TestEnvironment } from './test-setup';
import { createAppWithContainers } from './e2e-util';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let testEnv: TestEnvironment;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    app = await createAppWithContainers(testEnv);
  }, 120000);

  afterAll(async () => {
    if (app) {
      const cacheManager = app.get<Cache>(CACHE_MANAGER);
      const redisStore = cacheManager as unknown as {
        store?: {
          client?: {
            isOpen?: boolean;
            disconnect: () => Promise<void>;
            on: (event: string, cb: (err: any) => void) => void;
          };
        };
      };
      const client = redisStore.store?.client;
      if (client) {
        client.on('error', () => {
          /* ignore socket errors during teardown */
        });
        if (client.isOpen) {
          await client.disconnect();
        }
      }
      await app.close();
    }
  });

  it('/api (GET) should return Hello World!', () => {
    return request(app.getHttpServer() as SupertestApp)
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });
});
