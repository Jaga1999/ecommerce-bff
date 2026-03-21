import { ConfigService } from '@nestjs/config';
import { AppProperties } from './app.properties';
import { InternalServerErrorException } from '@nestjs/common';

describe('AppProperties', () => {
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn(),
    } as any as ConfigService;
  });

  it('should validate and return AppProperties instance with correct values', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      switch (key) {
        case 'NODE_ENV':
          return 'production';
        case 'APP_PORT':
        case 'PORT':
          return 9090;
        case 'BFF_CONTEXT_PATH':
          return '/api';
        case 'FRONTEND_URL':
          return 'https://frontend.com';
        case 'DASHBOARD_URL':
          return 'https://dashboard.com';
        default:
          return undefined;
      }
    });

    const props = AppProperties.fromConfigService(configService);

    expect(props.nodeEnv).toBe('production');
    expect(props.port).toBe(9090);
    expect(props.contextPath).toBe('/api');
    expect(props.frontendUrl).toBe('https://frontend.com');
    expect(props.dashboardUrl).toBe('https://dashboard.com');
  });

  it('should use default values for optional fields', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'NODE_ENV') return 'development';
      return undefined;
    });

    const props = AppProperties.fromConfigService(configService);

    expect(props.nodeEnv).toBe('development');
    expect(props.port).toBe(8080); // Default from AppProperties
    expect(props.contextPath).toBe('/api'); // Default from AppProperties
  });

  it('should throw InternalServerErrorException on invalid port', () => {
    (configService.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'APP_PORT' || key === 'PORT') return 70000; // Out of range [1, 65535]
      return 'test';
    });

    expect(() => AppProperties.fromConfigService(configService)).toThrow(
      InternalServerErrorException,
    );
  });

  it('should use default value for nodeEnv if missing', () => {
    (configService.get as jest.Mock).mockReturnValue(undefined);

    const props = AppProperties.fromConfigService(configService);

    expect(props.nodeEnv).toBe('development');
    expect(props.port).toBe(8080);
  });
});
