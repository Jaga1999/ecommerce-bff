import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';
import { BaseProperties } from './base.properties';
import { ConfigService } from '@nestjs/config';

export class KeycloakProperties extends BaseProperties {
  @IsString()
  @IsNotEmpty()
  serverUrl: string = '';

  @IsString()
  @IsNotEmpty()
  externalUrl: string = '';

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number = 8081;

  @IsString()
  @IsNotEmpty()
  realm: string = '';

  @IsString()
  @IsNotEmpty()
  clientId: string = '';

  @IsString()
  @IsNotEmpty()
  clientSecret: string = '';

  @IsString()
  @IsNotEmpty()
  adminUser: string = 'admin';

  @IsString()
  @IsNotEmpty()
  adminPass: string = 'admin';

  @IsString()
  @IsNotEmpty()
  adminClientId: string = 'admin-cli';

  static fromConfigService(configService: ConfigService): KeycloakProperties {
    return this.validate(KeycloakProperties, {
      serverUrl: configService.get<string>('APP_KEYCLOAK_SERVER_URL'),
      externalUrl: configService.get<string>('KC_EXTERNAL_URL'),
      port: configService.get<number>('KC_PORT'),
      realm: configService.get<string>('KC_REALM'),
      clientId: configService.get<string>('KC_CLIENT_ID'),
      clientSecret: configService.get<string>('KC_CLIENT_SECRET'),
      adminUser: configService.get<string>('KC_ADMIN_USER'),
      adminPass:
        configService.get<string>('KC_ADMIN_PASSWORD') ||
        configService.get<string>('KC_ADMIN_PASS'),
      adminClientId: configService.get<string>('KC_ADMIN_CLIENT_ID'),
    });
  }
}
