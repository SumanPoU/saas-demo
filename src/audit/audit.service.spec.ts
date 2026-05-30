import { AuditService } from './audit.service';

describe('AuditService', () => {
  let service: AuditService;
  let prisma: any;
  let pagination: any;

  beforeEach(() => {
    prisma = {
      auditLog: {},
    };
    pagination = {
      paginate: jest.fn(),
    };

    service = new AuditService(prisma, pagination);
  });

  it('paginates audit logs without search filters', async () => {
    pagination.paginate.mockResolvedValue({ data: [], meta: { total: 0 } });

    await expect(service.getAuditLogs({ page: 1, limit: 25 })).resolves.toEqual(
      {
        data: [],
        meta: { total: 0 },
      },
    );

    expect(pagination.paginate).toHaveBeenCalledWith(
      prisma.auditLog,
      { page: 1, limit: 25 },
      expect.objectContaining({
        where: {},
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

  it('adds action, entityType, and entityId search filters when search is present', async () => {
    pagination.paginate.mockResolvedValue({ data: [], meta: { total: 0 } });

    await service.getAuditLogs({
      page: 1,
      limit: 10,
      search: ' login ',
    });

    expect(pagination.paginate).toHaveBeenCalledWith(
      prisma.auditLog,
      expect.any(Object),
      expect.objectContaining({
        where: {
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
