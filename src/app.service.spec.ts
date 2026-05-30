import { AppService } from './app.service';

describe('AppService', () => {
  it('returns API metadata from package and config', () => {
    const service = new AppService({
      get: jest.fn().mockReturnValue('test'),
    } as any);

    const result = service.getApiInfo();

    expect(result).toMatchObject({
      environment: 'test',
      status: 'ok',
      endpoints: {
        health: '/v1/health',
      },
    });
    expect(result.name).toBeDefined();
    expect(result.version).toBeDefined();
    expect(new Date(result.timestamp).toString()).not.toBe('Invalid Date');
  });
});
