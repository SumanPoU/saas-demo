import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  HealthCheckService,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from '@nestjs/terminus';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('development'),
          },
        },
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockResolvedValue({ status: 'ok' }),
          },
        },
        {
          provide: MemoryHealthIndicator,
          useValue: {
            checkHeap: jest.fn(),
            checkRSS: jest.fn(),
          },
        },
        {
          provide: DiskHealthIndicator,
          useValue: {
            checkStorage: jest.fn(),
          },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return api info', () => {
      const result = appController.root();
      expect(result).toMatchObject({
        status: 'ok',
        environment: 'development',
        endpoints: { health: '/v1/health' },
      });
    });
  });

  describe('health', () => {
    it('should return health status', async () => {
      const result = await appController.check();
      expect(result).toMatchObject({ status: 'ok' });
    });
  });
});
