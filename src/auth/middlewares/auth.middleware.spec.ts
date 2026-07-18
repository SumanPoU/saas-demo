import { AuthMiddleware } from './auth.middleware';

describe('AuthMiddleware', () => {
  let middleware: AuthMiddleware;
  let jwtService: { verifyAsync: jest.Mock };
  let configService: { get: jest.Mock };
  let prisma: {
    userSession: { findUnique: jest.Mock };
    user: { findUnique: jest.Mock };
  };

  beforeEach(() => {
    jwtService = {
      verifyAsync: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue('jwt-secret'),
    };
    prisma = {
      userSession: {
        findUnique: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    middleware = new AuthMiddleware(jwtService, configService, prisma as never);
  });

  it('attaches user, roles, permissions, session, tenant, and mustChangePassword to the request', async () => {
    const req: {
      headers: { authorization: string };
      raw: Record<string, unknown>;
      user?: unknown;
    } = {
      headers: { authorization: 'Bearer access-token' },
      raw: {},
    };
    const next = jest.fn();

    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sessionId: 'session-1',
      purpose: 'access',
      iat: Math.floor(Date.now() / 1000),
    });
    prisma.userSession.findUnique.mockResolvedValue({
      id: 'session-1',
      tenantId: 'tenant-1',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      username: 'admin',
      email: 'admin@example.com',
      isActive: true,
      isSuperAdmin: false,
      mustChangePassword: true,
      passwordChangedAt: null,
      roles: [
        {
          name: 'Admin',
          rolePermissions: [
            { permission: { name: 'users:read' } },
            { permission: { name: 'users:create' } },
          ],
        },
      ],
    });

    await middleware.use(req, {}, next);

    expect(req.user).toEqual({
      id: 'user-1',
      username: 'admin',
      email: 'admin@example.com',
      isSuperAdmin: false,
      mustChangePassword: true,
      roles: ['Admin'],
      permissions: ['users:read', 'users:create'],
      sessionId: 'session-1',
      tenantId: 'tenant-1',
    });
    expect(req.raw.user).toBe(req.user);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('does not attach a user for MFA-pending tokens', async () => {
    const req: { headers: { authorization: string }; user?: unknown } = {
      headers: { authorization: 'Bearer mfa-token' },
    };
    const next = jest.fn();

    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      type: 'mfa_pending',
      purpose: 'access',
    });

    await middleware.use(req, {}, next);

    expect(req.user).toBeUndefined();
    expect(prisma.userSession.findUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects tokens missing the purpose claim', async () => {
    const req: { headers: { authorization: string }; user?: unknown } = {
      headers: { authorization: 'Bearer legacy-token' },
    };
    const next = jest.fn();

    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sessionId: 'session-1',
    });

    await middleware.use(req, {}, next);

    expect(req.user).toBeUndefined();
    expect(prisma.userSession.findUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rejects tokens with the wrong purpose for access routes', async () => {
    const req: { headers: { authorization: string }; user?: unknown } = {
      headers: { authorization: 'Bearer refresh-as-access' },
    };
    const next = jest.fn();

    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sessionId: 'session-1',
      purpose: 'refresh',
    });

    await middleware.use(req, {}, next);

    expect(req.user).toBeUndefined();
    expect(prisma.userSession.findUnique).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
