import { GenericContainer, Wait } from 'testcontainers';
import * as path from 'path';

async function testKeycloak() {
  console.log('Starting Keycloak test...');
  const realmPath = path.resolve(__dirname, 'keycloak/realm.json');
  const container = await new GenericContainer('quay.io/keycloak/keycloak:25.0.0')
    .withExposedPorts(8080)
    .withEnvironment({
      KEYCLOAK_ADMIN: 'admin',
      KEYCLOAK_ADMIN_PASSWORD: 'admin',
      KC_DB: 'dev-mem',
      KC_HOSTNAME_STRICT: 'false',
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
    .withWaitStrategy(Wait.forListeningPorts())
    .start();

  console.log('Keycloak started at:', container.getMappedPort(8080));
  await container.stop();
  console.log('Keycloak stopped.');
}

testKeycloak().catch(console.error);
