import { INestApplication } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import request from 'supertest';
import { App as SupertestApp } from 'supertest/types';
import { TestEnvironment } from './test-setup';
import { createAppWithContainers } from './e2e-util';
import {
  LoginResponse,
  AuthenticatedUser,
} from '../src/auth/interfaces/auth.interface';

describe('AuthController (e2e)', () => {
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

  describe('/api/auth', () => {
    const testUser = {
      username: `testuser_${Date.now()}`,
      email: `testuser_${Date.now()}@example.com`,
      password: 'TestPassword@123',
      firstName: 'Test',
      lastName: 'User',
    };

    it('/api/auth/register (POST) should register a new user', () => {
      return request(app.getHttpServer() as SupertestApp)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          const body = res.body as { message: string };
          expect(body.message).toBeDefined();
        });
    });

    it('/api/auth/register (POST) should fail with invalid data (validation check)', () => {
      return request(app.getHttpServer() as SupertestApp)
        .post('/api/auth/register')
        .send({
          username: '',
          email: 'invalid-email',
          password: '123',
        })
        .expect(400);
    });

    it('/api/auth/register (POST) should optionally fail when registering duplicate user', async () => {
      await request(app.getHttpServer() as SupertestApp)
        .post('/api/auth/register')
        .send({
          ...testUser,
          username: 'duplicate_user',
          email: 'duplicate@example.com',
        })
        .expect(201);

      return request(app.getHttpServer() as SupertestApp)
        .post('/api/auth/register')
        .send({
          ...testUser,
          username: 'duplicate_user',
          email: 'duplicate@example.com',
        })
        .expect(409);
    });

    it('/api/auth/login (POST) should login the user and set cookie', () => {
      return request(app.getHttpServer() as SupertestApp)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        })
        .expect(200)
        .expect((res) => {
          const body = res.body as LoginResponse;
          expect(body.message).toBeDefined();
          expect(res.headers['set-cookie']).toBeDefined();
        });
    });

    it('/api/auth/login (POST) should fail with wrong password', () => {
      return request(app.getHttpServer() as SupertestApp)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'WrongPassword@123',
        })
        .expect(401);
    });

    it('/api/auth/login (POST) should fail with non-existent user', () => {
      return request(app.getHttpServer() as SupertestApp)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent_user',
          password: 'SomePassword@123',
        })
        .expect(404);
    });

    it('/api/auth/me (GET) should return 401 without cookie', () => {
      return request(app.getHttpServer() as SupertestApp)
        .get('/api/auth/me')
        .expect(401);
    });

    it('/api/auth/me (GET) should return user profile with cookie', async () => {
      const loginRes = await request(app.getHttpServer() as SupertestApp)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const sessionCookie = cookies[0].split(';')[0];

      return request(app.getHttpServer() as SupertestApp)
        .get('/api/auth/me')
        .set('Cookie', [sessionCookie])
        .expect(200)
        .expect((res) => {
          const body = res.body as AuthenticatedUser;
          expect(body.username).toBe(testUser.username);
        });
    });

    it('/api/auth/logout (POST) should logout and clear session', async () => {
      const loginRes = await request(app.getHttpServer() as SupertestApp)
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        });

      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const sessionCookie = cookies[0].split(';')[0];

      return request(app.getHttpServer() as SupertestApp)
        .post('/api/auth/logout')
        .set('Cookie', [sessionCookie])
        .expect(204)
        .expect((res) => {
          expect(res.headers['set-cookie'][0]).toContain('SESSION_ID=;');
        });
    });
  });
});
