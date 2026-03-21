import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleProperties } from './google.properties';

describe('GoogleProperties', () => {
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
    expect(new GoogleProperties()).toBeDefined();
  });

  describe('fromConfigService', () => {
    it('should create GoogleProperties from config', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return 'google-id';
        if (key === 'GOOGLE_CLIENT_SECRET') return 'google-secret';
        return null;
      });

      const props = GoogleProperties.fromConfigService(configService);
      expect(props.clientId).toBe('google-id');
      expect(props.clientSecret).toBe('google-secret');
    });

    it('should throw error if config is missing', () => {
      jest.spyOn(configService, 'get').mockReturnValue(null);
      expect(() => GoogleProperties.fromConfigService(configService)).toThrow();
    });
  });
});
