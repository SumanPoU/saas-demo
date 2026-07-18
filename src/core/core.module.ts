import { Global, Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import {
  ThrottlerModule,
  ThrottlerGuard,
  ThrottlerModuleOptions,
} from '@nestjs/throttler';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { AuthModule } from '../auth/auth.module';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AuthMiddleware } from '../auth/middlewares/auth.middleware';
import { AUTH_THROTTLE_KEY } from '../auth/decorators/auth-throttle.decorator';
import { RuntimeConfigService } from '../config/runtime-config.service';

/**
 * Cross-cutting auth, throttling, and middleware — keeps AppModule focused
 * on feature-module composition.
 */
@Global()
@Module({
  imports: [
    AuthModule,
    ThrottlerModule.forRootAsync({
      inject: [RuntimeConfigService, Reflector],
      useFactory: (
        runtimeConfig: RuntimeConfigService,
        reflector: Reflector,
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
          {
            name: 'auth',
            ttl: () => runtimeConfig.getNumber('THROTTLE_AUTH_TTL'),
            limit: () => runtimeConfig.getNumber('THROTTLE_AUTH_LIMIT'),
            skipIf: (context) => {
              const isAuthSensitive = reflector.getAllAndOverride<boolean>(
                AUTH_THROTTLE_KEY,
                [context.getHandler(), context.getClass()],
              );
              return !isAuthSensitive;
            },
          },
        ],
      }),
    }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [AuthModule, ThrottlerModule],
})
export class CoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes('*');
  }
}
