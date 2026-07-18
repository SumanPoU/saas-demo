import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: { auditLog: Record<string, never> };
  let pagination: { paginate: jest.Mock };

  beforeEach(() => {
    prisma = {
      auditLog: {},
    };
    pagination = {
      paginate: jest.fn(),
    };

    service = new AuditService(prisma as never, pagination as never);
  });

  it('scopes audit logs to the requester tenant by default', async () => {
    pagination.paginate.mockResolvedValue({ data: [], meta: { total: 0 } });
    const inputUser = {
      tenantId: 'tenant-a',
      isSuperAdmin: false,
    };

    await expect(
      service.getAuditLogs({ page: 1, limit: 25 }, inputUser),
    ).resolves.toEqual({
      data: [],
      meta: { total: 0 },
    });

    expect(pagination.paginate).toHaveBeenCalledWith(
      prisma.auditLog,
      { page: 1, limit: 25 },
      expect.objectContaining({
        where: { tenantId: 'tenant-a' },
        orderBy: { createdAt: 'desc' },
        select: expect.objectContaining({
          action: true,
          actor: {
            select: {
              id: true,
              username: true,
              email: true,
            },
          },
        }),
      }),
    );
  });

  it('does not allow Tenant A to read Tenant B logs via missing tenantId', async () => {
    pagination.paginate.mockResolvedValue({ data: [], meta: { total: 0 } });
    const inputUser = {
      tenantId: 'tenant-a',
      isSuperAdmin: false,
    };

    await service.getAuditLogs({ page: 1, limit: 10 }, inputUser);

    const actualWhere = pagination.paginate.mock.calls[0][2].where;
    expect(actualWhere).toEqual(
      expect.objectContaining({ tenantId: 'tenant-a' }),
    );
    expect(actualWhere).not.toEqual({});
  });

  it('allows verified super-admins to read across tenants', async () => {
    pagination.paginate.mockResolvedValue({ data: [], meta: { total: 0 } });
    const inputSuperAdmin = {
      tenantId: 'tenant-a',
      isSuperAdmin: true,
    };

    await service.getAuditLogs({ page: 1, limit: 10 }, inputSuperAdmin);

    expect(pagination.paginate).toHaveBeenCalledWith(
      prisma.auditLog,
      expect.any(Object),
      expect.objectContaining({
        where: {},
      }),
    );
  });

  it('adds action, entityType, and entityId search filters when search is present', async () => {
    pagination.paginate.mockResolvedValue({ data: [], meta: { total: 0 } });

    await service.getAuditLogs(
      {
        page: 1,
        limit: 10,
        search: ' login ',
      },
      { tenantId: 'tenant-a', isSuperAdmin: false },
    );

    expect(pagination.paginate).toHaveBeenCalledWith(
      prisma.auditLog,
      expect.any(Object),
      expect.objectContaining({
        where: {
          tenantId: 'tenant-a',
          OR: [
            { action: { contains: 'login', mode: 'insensitive' } },
            { entityType: { contains: 'login', mode: 'insensitive' } },
            { entityId: { contains: 'login', mode: 'insensitive' } },
          ],
        },
      }),
    );
  });
});
