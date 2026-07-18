import { HttpStatus } from '@nestjs/common';
import { of, firstValueFrom } from 'rxjs';
import { ApiUsageInterceptor } from './api-usage.interceptor';

describe('ApiUsageInterceptor', () => {
  let interceptor: ApiUsageInterceptor;
  let limitsService: { recordApiUsage: jest.Mock };

  beforeEach(() => {
    limitsService = {
      recordApiUsage: jest.fn(),
    };
    interceptor = new ApiUsageInterceptor(limitsService as never);
  });

  it('records usage and allows the request when under the limit', async () => {
    limitsService.recordApiUsage.mockResolvedValue({ exceeded: false });
    const inputContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { tenantId: 'tenant-a' },
          route: { path: '/tenants/:tenantId/media' },
          url: '/tenants/tenant-a/media',
        }),
      }),
    };
    const next = { handle: jest.fn(() => of({ ok: true })) };

    const actual$ = await interceptor.intercept(
      inputContext as never,
      next as never,
    );

    expect(limitsService.recordApiUsage).toHaveBeenCalledWith(
      'tenant-a',
      '/tenants/:tenantId/media',
    );
    await expect(firstValueFrom(actual$)).resolves.toEqual({ ok: true });
  });

  it('throws 429 when the tenant API usage limit is exceeded', async () => {
    limitsService.recordApiUsage.mockResolvedValue({ exceeded: true });
    const inputContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          params: { tenantId: 'tenant-a' },
          url: '/tenants/tenant-a/feature-flags',
        }),
      }),
    };
    const next = { handle: jest.fn() };

    await expect(
      interceptor.intercept(inputContext as never, next as never),
    ).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('skips recording when no tenant context is present', async () => {
    const inputContext = {
      switchToHttp: () => ({
        getRequest: () => ({
          params: {},
          user: {},
          url: '/api/v1/health',
        }),
      }),
    };
    const next = { handle: jest.fn(() => of({ ok: true })) };

    await interceptor.intercept(inputContext as never, next as never);

    expect(limitsService.recordApiUsage).not.toHaveBeenCalled();
    expect(next.handle).toHaveBeenCalled();
  });
});
