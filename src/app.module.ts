import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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
import { RuntimeConfigModule } from './config/runtime-config.module';
import { RuntimeConfigService } from './config/runtime-config.service';
import { GlobalConfigModule } from './global-config/global-config.module';
import { TenantsModule } from './tenants/tenants.module';
import { TenantMembersModule } from './tenant-members/tenant-members.module';
import { BillingModule } from './billing/billing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      envFilePath: ['.env', '.env.development.local'],
      isGlobal: true,
      validate: validateEnv,
    }),
    RuntimeConfigModule,
    AppLoggerModule,
    TerminusModule,
    PrismaModule,
    AuthModule,
    MfaModule,
    RolesModule,
    PermissionsModule,
    UsersModule,
    AuditModule,
    GlobalConfigModule,
    TenantsModule,
    TenantMembersModule,
    BillingModule,
    MailModule,
    CommonModule,
    ThrottlerModule.forRootAsync({
      inject: [RuntimeConfigService],
      useFactory: (
        runtimeConfig: RuntimeConfigService,
      ): ThrottlerModuleOptions => ({
        throttlers: [
          {
            name: 'short',
            ttl: () => runtimeConfig.getNumber('THROTTLE_SHORT_TTL'),
            limit: () => runtimeConfig.getNumber('THROTTLE_SHORT_LIMIT'),
          },
          {
            name: 'long',
            ttl: () => runtimeConfig.getNumber('THROTTLE_LONG_TTL'),
            limit: () => runtimeConfig.getNumber('THROTTLE_LONG_LIMIT'),
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
