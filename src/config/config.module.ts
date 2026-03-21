import { Global, Module, Provider, Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppProperties } from './properties/app.properties';
import { DatabaseProperties } from './properties/db.properties';
import { KeycloakProperties } from './properties/keycloak.properties';
import { RedisProperties } from './properties/redis.properties';
import { SessionProperties } from './properties/session.properties';
import { GoogleProperties } from './properties/google.properties';

/**
 * Type representing a property class with a static factory method.
 * Each property class must implement fromConfigService(configService: ConfigService)
 */
type ConfigPropertyClass<T = object> = Type<T> & {
  fromConfigService(configService: ConfigService): T;
};

const configurationClasses: ConfigPropertyClass[] = [
  AppProperties,
  DatabaseProperties,
  KeycloakProperties,
  RedisProperties,
  SessionProperties,
  GoogleProperties,
];

/**
 * Creates a NestJS provider for a configuration property class.
 */
const createPropertyProvider = (
  propertyClass: ConfigPropertyClass,
): Provider => ({
  provide: propertyClass,
  useFactory: (configService: ConfigService) =>
    propertyClass.fromConfigService(configService),
  inject: [ConfigService],
});

@Global()
@Module({
  providers: configurationClasses.map(createPropertyProvider),
  exports: configurationClasses,
})
export class ConfigPropertiesModule {}
