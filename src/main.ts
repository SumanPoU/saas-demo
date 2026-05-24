import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { VersioningType } from '@nestjs/common';
import helmet from '@fastify/helmet';
import compression from '@fastify/compress';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  // 1. Logger first
  app.useLogger(app.get(Logger));

  // 2. Config — declare before use
  const configService = app.get(ConfigService);

  // 3. Helmet — security headers before anything else
  await app.register(helmet, {
    contentSecurityPolicy: configService.get('node_env') === 'production',
  });

  // 4. Compression — before CORS and routes
  await app.register(compression, {
    encodings: ['gzip', 'deflate'],
    threshold: 1024,
  });

  // 5. CORS
  const corsOrigins = configService.get<string[]>('cors.origin');
  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false,
  });

  // 6. URL versioning
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  // 7. Start the server
  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
