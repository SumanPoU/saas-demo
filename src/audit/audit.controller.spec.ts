import { AuditController } from './audit.controller';

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: { getAuditLogs: jest.Mock };

  beforeEach(() => {
    auditService = {
      getAuditLogs: jest.fn(),
    };
    controller = new AuditController(auditService as never);
  });

  it('delegates audit log listing with query params and actor user', async () => {
    const result = { data: [], meta: { total: 0 } };
    const query = { page: 1, limit: 25, search: 'login' };
    const inputUser = { tenantId: 'tenant-a', isSuperAdmin: false };
    auditService.getAuditLogs.mockResolvedValue(result);

    await expect(
      controller.getAuditLogs(query as never, inputUser),
    ).resolves.toBe(result);
    expect(auditService.getAuditLogs).toHaveBeenCalledWith(query, inputUser);
  });
});
