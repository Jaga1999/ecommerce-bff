import { INestApplication, ValidationPipe } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import request from 'supertest';
import { App } from 'supertest/types';
import cookieParser from 'cookie-parser';

import { TestEnvironment } from './test-setup';
import { createTestingModuleWithContainers } from './e2e-util';

interface TodoResponse {
  id?: string;
  title?: string;
  description?: string;
}

describe('TodosController (e2e)', () => {
  let app: INestApplication<App>;
  let testEnv: TestEnvironment;
  let sessionCookie: string;
  let todoId: string;

  const testUser = {
    username: `todo_tester_${Date.now()}`,
    email: `todo_tester_${Date.now()}@example.com`,
    password: 'Password@123',
    firstName: 'Todo',
    lastName: 'Tester',
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

    // Register and login to get session cookie
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send(testUser);

    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: testUser.password,
      });

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    sessionCookie = cookies[0].split(';')[0];
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

  describe('/api/todos (POST)', () => {
    it('should create a new todo', () => {
      return request(app.getHttpServer())
        .post('/api/todos')
        .set('Cookie', sessionCookie)
        .send({
          title: 'Test Todo',
          description: 'Test Description',
        })
        .expect(201)
        .expect((res) => {
          const body = res.body as TodoResponse;
          expect(body.title).toBe('Test Todo');
          expect(body.id).toBeDefined();
          todoId = body.id as string;
        });
    });
  });

  describe('/api/todos (GET)', () => {
    it('should get all todos for user', () => {
      return request(app.getHttpServer())
        .get('/api/todos')
        .set('Cookie', sessionCookie)
        .expect(200)
        .expect((res) => {
          const body = res.body as TodoResponse[];
          expect(Array.isArray(body)).toBe(true);
          expect(body.length).toBeGreaterThanOrEqual(1);
        });
    });
  });

  describe('/api/todos/:id (GET)', () => {
    it('should get a specific todo', () => {
      return request(app.getHttpServer())
        .get(`/api/todos/${todoId}`)
        .set('Cookie', sessionCookie)
        .expect(200)
        .expect((res) => {
          const body = res.body as TodoResponse;
          expect(body.id).toBe(todoId);
        });
    });
  });

  describe('/api/todos/:id (PATCH)', () => {
    it('should update a specific todo', () => {
      return request(app.getHttpServer())
        .patch(`/api/todos/${todoId}`)
        .set('Cookie', sessionCookie)
        .send({
          title: 'Updated Todo',
        })
        .expect(200);
    });
  });

  describe('/api/todos/:id (DELETE)', () => {
    it('should delete a specific todo', () => {
      return request(app.getHttpServer())
        .delete(`/api/todos/${todoId}`)
        .set('Cookie', sessionCookie)
        .expect(200);
    });
  });
});
