import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import * as path from 'path';

export interface TestEnvValues {
  db: {
    host: string;
    port: number;
    name: string;
    user: string;
    pass: string;
  };
  redis: {
    host: string;
    port: number;
  };
  keycloak: {
    url: string;
    adminUser: string;
    adminPass: string;
  };
}

export class TestEnvironment {
  private pgContainer: StartedPostgreSqlContainer;
  private redisContainer: StartedRedisContainer;
  private keycloakContainer: StartedTestContainer;

  async start(): Promise<TestEnvValues> {
    console.log('Starting test environment...');
    const uniqueId = Date.now();
    // Start Postgres
    this.pgContainer = await new PostgreSqlContainer('postgres:16')
      .withName(`postgres-${uniqueId}`)
      .withDatabase('ecommerce_app_test')
      .withUsername('ecommerce')
      .withPassword('change_me')
      .start();

    // Start Redis
    this.redisContainer = await new RedisContainer('redis:7-alpine')
      .withName(`redis-${uniqueId}`)
      .start();

    // Start Keycloak
    const realmPath = path.resolve(__dirname, '../keycloak/realm.json');
    this.keycloakContainer = await new GenericContainer(
      'quay.io/keycloak/keycloak:25.0.0',
    )
      .withName(`keycloak-${uniqueId}`)
      .withExposedPorts(8080)
      .withEnvironment({
        KEYCLOAK_ADMIN: 'admin',
        KEYCLOAK_ADMIN_PASSWORD: 'admin',
        KC_DB: 'dev-mem',
        KC_HOSTNAME_STRICT: 'false',
        KC_HTTP_PORT: '8080',
        APP_PORT: '8080',
        KC_PORT: '8080',
        KC_CLIENT_SECRET: 'change_me',
        KC_REALM: 'ecommerce-realm',
        GOOGLE_CLIENT_ID: 'dummy-id',
        GOOGLE_CLIENT_SECRET: 'dummy-secret',
      })
      .withCopyFilesToContainer([
        {
          source: realmPath,
          target: '/opt/keycloak/data/import/realm.json',
        },
      ])
      .withCommand(['start-dev', '--import-realm'])
      .withWaitStrategy(Wait.forLogMessage(/Keycloak.*started/i))
      .withStartupTimeout(120000)
      .withLogConsumer((stream) => {
        let shouldLog = false;
        stream.on('data', (data: Buffer) => {
          const line = data.toString().trim();
          if (line.includes('Initializing master realm')) {
            shouldLog = true;
          }
          if (shouldLog) {
            console.log(`[Keycloak] ${line}`);
          }
          if (line.includes('Installed features:')) {
            shouldLog = false;
          }
        });
        stream.on('err', (data: Buffer) => {
          const line = data.toString().trim();
          console.error(`[Keycloak Error] ${line}`);
        });
      })
      .start();

    return {
      db: {
        host: this.pgContainer.getHost(),
        port: this.pgContainer.getPort(),
        name: 'ecommerce_app_test',
        user: 'ecommerce',
        pass: 'change_me',
      },
      redis: {
        host: this.redisContainer.getHost(),
        port: this.redisContainer.getMappedPort(6379),
      },
      keycloak: {
        url: `http://${this.keycloakContainer.getHost()}:${this.keycloakContainer.getMappedPort(8080)}`,
        adminUser: 'admin',
        adminPass: 'admin',
      },
    };
  }

  async stop() {
    await Promise.all([
      this.pgContainer?.stop(),
      this.redisContainer?.stop(),
      this.keycloakContainer?.stop(),
    ]);
  }
}
