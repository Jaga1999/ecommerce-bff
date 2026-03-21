import { IsInt, IsString, Min, Max, IsBoolean } from 'class-validator';
import { BaseProperties } from './base.properties';
import { ConfigService } from '@nestjs/config';

export class DatabaseProperties extends BaseProperties {
  @IsString()
  host: string = 'localhost';

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number = 5433;

  @IsString()
  name: string = 'bff_app';

  @IsString()
  user: string = 'bff';

  @IsString()
  pass: string = 'change_me';

  @IsBoolean()
  migrationsRun: boolean = true;

  static fromConfigService(configService: ConfigService): DatabaseProperties {
    return this.validate(DatabaseProperties, {
      host:
        configService.get<string>('APP_DB_HOST') ||
        configService.get<string>('DB_HOST'),
      port:
        configService.get<number>('APP_DB_PORT') ||
        configService.get<number>('DB_PORT'),
      name:
        configService.get<string>('APP_DB_NAME') ||
        configService.get<string>('DB_NAME'),
      user:
        configService.get<string>('APP_DB_USER') ||
        configService.get<string>('DB_USER'),
      pass:
        configService.get<string>('APP_DB_PASSWORD') ||
        configService.get<string>('DB_PASSWORD') ||
        configService.get<string>('DB_PASS'),
      migrationsRun: configService.get<string>('DB_MIGRATIONS_RUN') === 'true',
    });
  }
}
