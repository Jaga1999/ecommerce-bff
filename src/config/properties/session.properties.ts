import { IsString, IsNotEmpty } from 'class-validator';
import { BaseProperties } from './base.properties';
import { ConfigService } from '@nestjs/config';

export class SessionProperties extends BaseProperties {
  @IsString()
  @IsNotEmpty()
  idHeader: string = 'X-Session-ID';

  @IsString()
  @IsNotEmpty()
  cookieName: string = 'SESSION_ID';

  static fromConfigService(configService: ConfigService): SessionProperties {
    return this.validate(SessionProperties, {
      idHeader: configService.get<string>('SESSION_ID_HEADER'),
      cookieName: configService.get<string>('SESSION_COOKIE_NAME'),
    });
  }
}
