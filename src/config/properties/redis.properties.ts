import { IsInt, IsString, Min, Max } from 'class-validator';
import { BaseProperties } from './base.properties';
import { ConfigService } from '@nestjs/config';

export class RedisProperties extends BaseProperties {
  @IsString()
  host: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number = 6379;

  static fromConfigService(configService: ConfigService): RedisProperties {
    return this.validate(RedisProperties, {
      host: configService.get<string>('REDIS_HOST'),
      port: configService.get<number>('REDIS_PORT'),
    });
  }
}
