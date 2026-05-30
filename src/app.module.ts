import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import {
  ThrottlerModule,
  ThrottlerGuard,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppLoggerModule } from './logger/logger.module';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MfaModule } from './mfa/mfa.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { AuthGuard } from './auth/guards/auth.guard';
import { AuthMiddleware } from './auth/middlewares/auth.middleware';
import { MailModule } from './mail/mail.module';
import { CommonModule } from './common/common.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      envFilePath: ['.env', '.env.development.local'],
      isGlobal: true,
      validate: validateEnv,
    }),
    AppLoggerModule,
    TerminusModule,
    PrismaModule,
    AuthModule,
    MfaModule,
    RolesModule,
    PermissionsModule,
    UsersModule,
    AuditModule,
    MailModule,
    CommonModule,
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
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
