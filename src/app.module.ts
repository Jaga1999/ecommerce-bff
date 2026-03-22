import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigPropertiesModule } from './config/config.module';
import { DatabaseProperties } from './config/properties/db.properties';
import { RedisProperties } from './config/properties/redis.properties';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TodosModule } from './todos/todos.module';
import { User } from './users/user.entity';
import { Role } from './users/role.entity';
import { Todo } from './todos/todo.entity';
import { APP_GUARD } from '@nestjs/core';
import { SessionGuard } from './common/guards/session.guard';
import { MigrationService } from './database/migration.service';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ConfigPropertiesModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigPropertiesModule],
      useFactory: (dbProps: DatabaseProperties) => ({
        type: 'postgres',
        host: dbProps.host,
        port: dbProps.port,
        username: dbProps.user,
        password: dbProps.pass,
        database: dbProps.name,
        entities: [User, Role, Todo],
        migrations: [__dirname + '/migrations/**/*{.ts,.js}'],
        synchronize: false,
        migrationsRun: false,
      }),
      inject: [DatabaseProperties],
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      imports: [ConfigPropertiesModule],
      useFactory: async (redisProps: RedisProperties) => ({
        store: await redisStore({
          url: `redis://${redisProps.host}:${redisProps.port}`,
        }),
      }),
      inject: [RedisProperties],
    }),
    AuthModule,
    UsersModule,
    TodosModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: SessionGuard,
    },
    MigrationService,
  ],
})
export class AppModule {}
