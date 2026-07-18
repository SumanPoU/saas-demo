import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppLoggerModule } from './logger/logger.module';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { CoreModule } from './core/core.module';
import { AuthModule } from './auth/auth.module';
import { MfaModule } from './mfa/mfa.module';
import { RolesModule } from './roles/roles.module';
import { PermissionsModule } from './permissions/permissions.module';
import { MailModule } from './mail/mail.module';
import { CommonModule } from './common/common.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { RuntimeConfigModule } from './config/runtime-config.module';
import { GlobalConfigModule } from './global-config/global-config.module';
import { TenantsModule } from './tenants/tenants.module';
import { TenantMembersModule } from './tenant-members/tenant-members.module';
import { BillingModule } from './billing/billing.module';
import { MediaModule } from './media/media.module';
import { LimitsModule } from './limits/limits.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';

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
    CoreModule,
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
    MediaModule,
    LimitsModule,
    FeatureFlagsModule,
    MailModule,
    CommonModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
