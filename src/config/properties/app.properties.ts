import { IsInt, IsOptional, IsString, Min, Max } from 'class-validator';
import { BaseProperties } from './base.properties';
import { ConfigService } from '@nestjs/config';

export class AppProperties extends BaseProperties {
  @IsString()
  nodeEnv: string = 'development';

  @IsInt()
  @Min(1)
  @Max(65535)
  port: number = 8080;

  @IsString()
  contextPath: string = 'api';

  @IsString()
  @IsOptional()
  swaggerpath: string = 'docs';

  @IsString()
  @IsOptional()
  frontendUrl: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  dashboardUrl: string = 'http://localhost:3000/dashboard';

  static fromConfigService(configService: ConfigService): AppProperties {
    return this.validate(AppProperties, {
      nodeEnv: configService.get<string>('NODE_ENV'),
      port:
        configService.get<number>('APP_PORT') ||
        configService.get<number>('PORT'),
      contextPath: configService.get<string>('BFF_CONTEXT_PATH'),
      swaggerpath: configService.get<string>('SWAGGER_PATH'),
      frontendUrl: configService.get<string>('FRONTEND_URL'),
      dashboardUrl: configService.get<string>('DASHBOARD_URL'),
    });
  }
}
