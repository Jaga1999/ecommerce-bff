import { IsString, IsNotEmpty } from 'class-validator';
import { BaseProperties } from './base.properties';
import { ConfigService } from '@nestjs/config';

export class GoogleProperties extends BaseProperties {
  @IsString()
  @IsNotEmpty()
  clientId: string = '';

  @IsString()
  @IsNotEmpty()
  clientSecret: string = '';

  static fromConfigService(configService: ConfigService): GoogleProperties {
    return this.validate(GoogleProperties, {
      clientId: configService.get<string>('GOOGLE_CLIENT_ID'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET'),
    });
  }
}
