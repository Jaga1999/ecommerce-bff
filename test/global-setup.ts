import { TestEnvironment } from './test-setup';

export default async () => {
  console.log('\n--- Starting Global Test Environment ---');
  const testEnv = new TestEnvironment();
  const envValues = await testEnv.start();

  // Export container details to environment variables so all tests can see them
  process.env.TEST_DB_HOST = envValues.db.host;
  process.env.TEST_DB_PORT = envValues.db.port.toString();
  process.env.TEST_DB_NAME = envValues.db.name;
  process.env.TEST_DB_USER = envValues.db.user;
  process.env.TEST_DB_PASS = envValues.db.pass;

  process.env.TEST_REDIS_HOST = envValues.redis.host;
  process.env.TEST_REDIS_PORT = envValues.redis.port.toString();

  process.env.TEST_KEYCLOAK_URL = envValues.keycloak.url;
  process.env.TEST_KEYCLOAK_ADMIN_USER = envValues.keycloak.adminUser;
  process.env.TEST_KEYCLOAK_ADMIN_PASS = envValues.keycloak.adminPass;

  // Store the instance globally for teardown
  const globalObj = globalThis as unknown as {
    __TEST_ENVIRONMENT__?: TestEnvironment;
  };
  globalObj.__TEST_ENVIRONMENT__ = testEnv;
  console.log('--- Global Test Environment Ready ---\n');
};
