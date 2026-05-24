import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { AppService } from './app.service';

@SkipThrottle()
@Controller({ version: '1' })
export class AppController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly disk: DiskHealthIndicator,
    private readonly appService: AppService,
  ) {}

  @Get()
  root() {
    return this.appService.getApiInfo();
  }

  @Get('health')
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 500 * 1024 * 1024),
      () =>
        this.disk.checkStorage('disk', {
          path: process.platform === 'win32' ? 'E:\\' : '/',
          thresholdPercent: 0.9,
        }),
    ]);
  }
}
