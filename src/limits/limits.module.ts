import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { LimitsService } from './limits.service';
import { ApiUsageInterceptor } from './api-usage.interceptor';

@Module({
  providers: [
    LimitsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ApiUsageInterceptor,
    },
  ],
  exports: [LimitsService],
})
export class LimitsModule {}
