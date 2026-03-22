import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import * as path from 'path';

export class TestEnvironment {
  private pgContainer: StartedPostgreSqlContainer;
  private redisContainer: StartedRedisContainer;
  private keycloakContainer: StartedTestContainer;

  async start() {
    // Start Postgres
    this.pgContainer = await new PostgreSqlContainer('postgres:16')
      .withDatabase('ecommerce_app_test')
      .withUsername('ecommerce')
      .withPassword('change_me')
      .start();

    // Start Redis
    this.redisContainer = await new RedisContainer('redis:7-alpine').start();

    // Start Keycloak
    const realmPath = path.resolve(__dirname, '../keycloak/realm.json');
    this.keycloakContainer = await new GenericContainer(
      'quay.io/keycloak/keycloak:25.0.0',
    )
      .withExposedPorts(8080)
      .withEnvironment({
        KEYCLOAK_ADMIN: 'admin',
        KEYCLOAK_ADMIN_PASSWORD: 'admin',
        KC_DB: 'dev-mem',
        KC_HOSTNAME_STRICT: 'false',
      })
      .withCopyFilesToContainer([
        {
          source: realmPath,
          target: '/opt/keycloak/data/import/realm.json',
        },
      ])
      .withCommand(['start-dev', '--import-realm'])
      .withWaitStrategy(Wait.forHttp('/health/ready', 8080))
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
