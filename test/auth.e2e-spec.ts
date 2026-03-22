import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';

import { TestEnvironment } from './test-setup';
import { createTestingModuleWithContainers } from './e2e-util';

interface AuthResponse {
  message?: string;
  user?: {
    username?: string;
    email?: string;
  };
  username?: string;
  email?: string;
}

describe('AuthController (e2e)', () => {
  let app: INestApplication<App>;
  let testEnv: TestEnvironment;
  let sessionCookie: string;

  const testUser = {
    username: `testuser_${Date.now()}`,
    email: `testuser_${Date.now()}@example.com`,
    password: 'Password@123',
    firstName: 'Test',
    lastName: 'User',
  };

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    const moduleBuilder = await createTestingModuleWithContainers(testEnv);
    const moduleFixture = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();

    // Setup identical to main.ts
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

  describe('/api/auth/register (POST)', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect(201)
        .expect((res) => {
          const body = res.body as AuthResponse;
          expect(body.message).toBeDefined();
        });
    });

    it('should fail with invalid data (validation check)', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ username: 'short' })
        .expect(400);
    });

    it('should optionally fail when registering duplicate user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send(testUser)
        .expect((res) => {
          expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });
  });

  describe('/api/auth/login (POST)', () => {
    it('should login the user and set cookie', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: testUser.password,
        })
        .expect(200)
        .expect((res) => {
          const body = res.body as AuthResponse;
          expect(body.message).toBeDefined();
          expect(body.user).toBeDefined();
          expect(body.user?.username).toBe(testUser.username);

          const cookies = res.headers['set-cookie'] as unknown as string[];
          expect(cookies).toBeDefined();
          sessionCookie = cookies[0].split(';')[0];
        });
    });

    it('should fail with wrong password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: testUser.username,
          password: 'WrongPassword@123',
        })
        .expect(401);
    });

    it('should fail with non-existent user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({
          username: 'doesntexist_anywhere',
          password: 'Password@123',
        })
        .expect(404);
    });
  });

  describe('/api/auth/me (GET)', () => {
    it('should return 401 without cookie', () => {
      return request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('should return user profile with cookie', () => {
      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', sessionCookie)
        .expect(200)
        .expect((res) => {
          const body = res.body as AuthResponse;
          expect(body.username).toBe(testUser.username);
        });
    });
  });

  describe('/api/auth/logout (POST)', () => {
    it('should logout and clear session', () => {
      return request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', sessionCookie)
        .expect(204);
    });
  });
});
