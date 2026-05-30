import { NestFactory, Reflector } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { VersioningType, ValidationPipe, BadRequestException } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import compression from '@fastify/compress';
import { AppModule } from './app.module';
import { ResponseInterceptor, GlobalExceptionFilter, formatValidationErrors } from './common/response';

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
    crossOriginEmbedderPolicy: configService.get('node_env') === 'production',
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

  // 6b. Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors) => new BadRequestException({
        message: 'Validation Failed',
        errors: formatValidationErrors(errors),
      }),
    }),
  );

  // 6c. Global Interceptor & Filter
  const reflector = app.get(Reflector);
  app.useGlobalInterceptors(new ResponseInterceptor(reflector));
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 7. Swagger API Documentation Setup
  if (configService.get('node_env') !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('SaaS NestJS Demo API')
      .setDescription(
        'The interactive API documentation for the NestJS SaaS demonstration application.',
      )
      .setVersion(configService.get('version') ?? '1.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token to authenticate',
        in: 'header',
      })
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  // 8. Start the server
  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port, '0.0.0.0');
}
bootstrap();
