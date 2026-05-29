import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { name, version } from '../package.json';

@Injectable()
export class AppService {
  constructor(private readonly config: ConfigService) {}

  getApiInfo() {
    return {
      name,
      version,
      environment: this.config.get<string>('node_env'),
      status: 'ok',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/v1/health',
      },
    };
  }
}
