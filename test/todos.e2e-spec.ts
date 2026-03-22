import { INestApplication } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import request from 'supertest';
import { App as SupertestApp } from 'supertest/types';
import { Todo } from '../src/todos/todo.entity';
import { TestEnvironment } from './test-setup';
import { createAppWithContainers } from './e2e-util';

describe('TodosController (e2e)', () => {
  let app: INestApplication;
  let testEnv: TestEnvironment;
  let sessionCookie: string;
  let todoId: string;

  beforeAll(async () => {
    testEnv = new TestEnvironment();
    app = await createAppWithContainers(testEnv);

    // Create a test user and login to get session cookie
    const testUser = {
      username: `testuser_${Date.now()}`,
      email: `testuser_${Date.now()}@example.com`,
      password: 'TestPassword@123',
      firstName: 'Test',
      lastName: 'User',
    };

    await request(app.getHttpServer() as SupertestApp)
      .post('/api/auth/register')
      .send(testUser)
      .expect(201);

    const loginRes = await request(app.getHttpServer() as SupertestApp)
      .post('/api/auth/login')
      .send({
        username: testUser.username,
        password: testUser.password,
      })
      .expect(200);

    const cookies = loginRes.headers['set-cookie'] as unknown as string[];
    sessionCookie = cookies[0].split(';')[0];
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

  describe('/api/todos', () => {
    it('/api/todos (POST) should create a new todo', () => {
      return request(app.getHttpServer() as SupertestApp)
        .post('/api/todos')
        .set('Cookie', [sessionCookie])
        .send({
          title: 'Test Todo',
          description: 'Test Description',
        })
        .expect(201)
        .expect((res) => {
          const body = res.body as Todo;
          expect(body.title).toBe('Test Todo');
          expect(body.id).toBeDefined();
          todoId = body.id;
        });
    });

    it('/api/todos (GET) should return all todos for user', () => {
      return request(app.getHttpServer() as SupertestApp)
        .get('/api/todos')
        .set('Cookie', [sessionCookie])
        .expect(200)
        .expect((res) => {
          const body = res.body as Todo[];
          expect(Array.isArray(body)).toBe(true);
          expect(body.length).toBeGreaterThan(0);
        });
    });

    it('/api/todos/:id (GET) should return a specific todo', () => {
      return request(app.getHttpServer() as SupertestApp)
        .get(`/api/todos/${todoId}`)
        .set('Cookie', [sessionCookie])
        .expect(200)
        .expect((res) => {
          const body = res.body as Todo;
          expect(body.id).toBe(todoId);
          expect(body.title).toBe('Test Todo');
        });
    });

    it('/api/todos/:id (PATCH) should update a todo', () => {
      return request(app.getHttpServer() as SupertestApp)
        .patch(`/api/todos/${todoId}`)
        .set('Cookie', [sessionCookie])
        .send({
          title: 'Updated Todo',
        })
        .expect(200)
        .expect((res) => {
          const body = res.body as Todo;
          expect(body.title).toBe('Updated Todo');
        });
    });

    it('/api/todos/:id (DELETE) should delete a todo', () => {
      return request(app.getHttpServer() as SupertestApp)
        .delete(`/api/todos/${todoId}`)
        .set('Cookie', [sessionCookie])
        .expect(200);
    });

    it('/api/todos/:id (GET) should return 404 after deletion', () => {
      return request(app.getHttpServer() as SupertestApp)
        .get(`/api/todos/${todoId}`)
        .set('Cookie', [sessionCookie])
        .expect(404);
    });
  });
});
