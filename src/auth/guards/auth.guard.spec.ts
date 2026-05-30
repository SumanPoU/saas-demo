import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: AuthGuard;

  const context = (request: any = {}) =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    }) as any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new AuthGuard(reflector as any);
  });

  it('allows public routes without a user', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(true);

    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('rejects protected routes without authenticated user context', async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(false);

    await expect(
      guard.canActivate(context({ url: '/v1/users' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('blocks users who must change password from non-password routes', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    await expect(
      guard.canActivate(
        context({
          url: '/v1/users',
          user: {
            id: 'user-1',
            sessionId: 'session-1',
            mustChangePassword: true,
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows users who must change password to access the change-password route', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce(undefined);

    await expect(
      guard.canActivate(
        context({
          url: '/v1/auth/change-password',
          user: {
            id: 'user-1',
            sessionId: 'session-1',
            mustChangePassword: true,
          },
        }),
      ),
    ).resolves.toBe(true);
  });

  it('enforces all required permissions for non-super-admin users', async () => {
    reflector.getAllAndOverride
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(['Admin'])
      .mockReturnValueOnce(['users:read', 'users:create']);

    await expect(
      guard.canActivate(
        context({
          url: '/v1/users',
          user: {
            id: 'user-1',
            sessionId: 'session-1',
            mustChangePassword: false,
            roles: ['Admin'],
            permissions: ['users:read'],
          },
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
