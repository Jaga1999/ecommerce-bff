import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionProperties } from './session.properties';

describe('SessionProperties', () => {
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(new SessionProperties()).toBeDefined();
  });

  describe('fromConfigService', () => {
    it('should create SessionProperties from config', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'SESSION_ID_HEADER') return 'X-Custom-Header';
        if (key === 'SESSION_COOKIE_NAME') return 'CUSTOM_SESSION';
        return null;
      });

      const props = SessionProperties.fromConfigService(configService);
      expect(props.idHeader).toBe('X-Custom-Header');
      expect(props.cookieName).toBe('CUSTOM_SESSION');
    });

    it('should throw error if config is missing', () => {
      jest.spyOn(configService, 'get').mockReturnValue(null);
      expect(() =>
        SessionProperties.fromConfigService(configService),
      ).toThrow();
    });
  });
});
