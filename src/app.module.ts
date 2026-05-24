import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
import { createStream } from 'rotating-file-stream';
import pino from 'pino';
import pretty from 'pino-pretty';
import * as path from 'path';
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
        const logLevel = isProduction ? 'info' : 'debug';

        // 1. Console stream
        const consoleStream = isProduction
          ? process.stdout
          : pretty({
              colorize: true,
              singleLine: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            });

        // 2. Daily rotating file stream — logs/YYYY-MM-DD/app.log
        const fileStream = createStream(
          (time: number | Date | null, index?: number) => {
            if (!time) return 'app.log';
            // fix: handle both number and Date
            const date = time instanceof Date ? time : new Date(time);
            const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
            const suffix = index ? `-${index}` : '';
            return `${dateString}${path.sep}app${suffix}.log`;
          },
          {
            path: 'logs',
            interval: '1d',       // rotate daily
            compress: 'gzip',     // compress old logs
            maxFiles: 30,         // keep 30 days of logs
          },
        );

        // 3. Combine console + file
        const multiStream = pino.multistream([
          { stream: consoleStream, level: logLevel },
          { stream: fileStream, level: logLevel },   // always JSON to file
        ]);

        return {
          pinoHttp: [
            {
              level: logLevel,
              // standard log format fields
              serializers: {
                req: (req) => ({
                  id: req.id,
                  method: req.method,
                  url: req.url,
                  remoteAddress: req.remoteAddress,
                }),
                res: (res) => ({
                  statusCode: res.statusCode,
                }),
              },
              redact: {
                paths: [
                  'req.headers.authorization',
                  'req.body.password',
                  'req.body.token',
                  'req.body.refreshToken',
                ],
                remove: true,
              },
            },
            multiStream,
          ],
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