import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import {
  ThrottlerModule,
  ThrottlerGuard,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      envFilePath: ['.env', '.env.development.local'],
      isGlobal: true,
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('node_env') === 'production';
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            transport: isProduction
              ? undefined // raw JSON in production
              : {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:standard', // human-readable timestamp
                    ignore: 'pid,hostname', // cleaner dev output
                  },
                },
            redact: {
              paths: [
                // never log sensitive fields
                'req.headers.authorization',
                'req.body.password',
                'req.body.token',
              ],
              remove: true,
            },
          },
        };
      },
    }),
    TerminusModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): ThrottlerModuleOptions => ({
        throttlers: [
          {
            name: 'short',
            ttl: config.get<number>('throttle.short.ttl') ?? 1000,
            limit: config.get<number>('throttle.short.limit') ?? 10,
          },
          {
            name: 'long',
            ttl: config.get<number>('throttle.long.ttl') ?? 60000,
            limit: config.get<number>('throttle.long.limit') ?? 100,
          },
        ],
      }),
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
