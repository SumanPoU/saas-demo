import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import pino from 'pino';
import pretty from 'pino-pretty';
import { buildFileStream } from './logger.stream';

@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProduction = config.get<string>('node_env') === 'production';
        const logLevel = isProduction ? 'info' : 'debug';

        const consoleStream = isProduction
          ? process.stdout
          : pretty({
              colorize: true,
              singleLine: true,
              translateTime: 'SYS:standard',
              ignore: 'pid,hostname',
            });

        const multiStream = pino.multistream([
          { stream: consoleStream, level: logLevel },
          { stream: buildFileStream(), level: logLevel },
        ]);

        return {
          pinoHttp: [
            {
              level: logLevel,
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
  ],
  exports: [LoggerModule],
})
export class AppLoggerModule {}
