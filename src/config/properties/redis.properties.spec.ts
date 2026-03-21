import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RedisProperties } from './redis.properties';

describe('RedisProperties', () => {
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
    expect(new RedisProperties()).toBeDefined();
  });

  describe('fromConfigService', () => {
    it('should create RedisProperties from config', () => {
      jest.spyOn(configService, 'get').mockImplementation((key: string) => {
        if (key === 'REDIS_HOST') return 'redis-host';
        if (key === 'REDIS_PORT') return 6379;
        return null;
      });

      const props = RedisProperties.fromConfigService(configService);
      expect(props.host).toBe('redis-host');
      expect(props.port).toBe(6379);
    });

    it('should use default values if config is missing but not required', () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      const props = RedisProperties.fromConfigService(configService);
      expect(props.host).toBe('localhost');
      expect(props.port).toBe(6379);
    });
  });
});
