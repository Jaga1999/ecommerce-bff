import { ConfigService } from '@nestjs/config';
import { KeycloakProperties } from './keycloak.properties';
import { InternalServerErrorException } from '@nestjs/common';

describe('KeycloakProperties', () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as any as ConfigService;
  });

  it('should validate and return KeycloakProperties instance with correct values', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'APP_KEYCLOAK_SERVER_URL':
          return 'http://keycloak:8080';
        case 'KC_EXTERNAL_URL':
          return 'http://localhost:8081';
        case 'KC_PORT':
          return 8081;
        case 'KC_REALM':
          return 'test-realm';
        case 'KC_CLIENT_ID':
          return 'test-client';
        case 'KC_CLIENT_SECRET':
          return 'secret';
        case 'KC_ADMIN_USER':
          return 'admin';
        case 'KC_ADMIN_PASSWORD':
          return 'admin-pass';
        case 'KC_ADMIN_CLIENT_ID':
          return 'admin-cli';
        default:
          return undefined;
      }
    });

    const props = KeycloakProperties.fromConfigService(configService);

    expect(props.serverUrl).toBe('http://keycloak:8080');
    expect(props.port).toBe(8081);
    expect(props.adminClientId).toBe('admin-cli');
  });

  it('should use default values for admin credentials if missing', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (
        key === 'APP_KEYCLOAK_SERVER_URL' ||
        key === 'KC_EXTERNAL_URL' ||
        key === 'KC_REALM' ||
        key === 'KC_CLIENT_ID' ||
        key === 'KC_CLIENT_SECRET'
      ) {
        return 'value';
      }
      return undefined;
    });

    const props = KeycloakProperties.fromConfigService(configService);

    expect(props.adminUser).toBe('admin');
    expect(props.adminPass).toBe('admin');
    expect(props.adminClientId).toBe('admin-cli');
  });

  it('should throw InternalServerErrorException on missing essential field (realm)', () => {
    (configService.get as jest.Mock).mockReturnValue(undefined);

    expect(() => KeycloakProperties.fromConfigService(configService)).toThrow(
      InternalServerErrorException,
    );
  });
});
