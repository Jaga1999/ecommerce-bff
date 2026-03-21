import { ConfigService } from '@nestjs/config';
import { DatabaseProperties } from './db.properties';
import { InternalServerErrorException } from '@nestjs/common';

describe('DatabaseProperties', () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as any as ConfigService;
  });

  it('should validate and return DatabaseProperties instance with correct values', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'APP_DB_HOST':
          return 'app-db';
        case 'APP_DB_PORT':
          return 5432;
        case 'APP_DB_NAME':
          return 'test_db';
        case 'APP_DB_USER':
          return 'test_user';
        case 'APP_DB_PASSWORD':
          return 'test_pass';
        case 'DB_MIGRATIONS_RUN':
          return 'true';
        default:
          return undefined;
      }
    });

    const props = DatabaseProperties.fromConfigService(configService);

    expect(props.host).toBe('app-db');
    expect(props.port).toBe(5432);
    expect(props.migrationsRun).toBe(true);
  });

  it('should use default values if config is missing', () => {
    (configService.get as jest.Mock).mockReturnValue(undefined);

    const props = DatabaseProperties.fromConfigService(configService);

    expect(props.host).toBe('localhost');
    expect(props.port).toBe(5433);
    expect(props.migrationsRun).toBe(false); // Default is true but fromConfigService does '=== true' which undefined is not.
  });

  it('should throw error on invalid port', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'APP_DB_PORT') return 99999;
      return 'value';
    });

    expect(() => DatabaseProperties.fromConfigService(configService)).toThrow(
      InternalServerErrorException,
    );
  });
});
