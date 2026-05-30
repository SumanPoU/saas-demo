import { AuditController } from './audit.controller';

describe('AuditController', () => {
  let controller: AuditController;
  let auditService: any;

  beforeEach(() => {
    auditService = {
      getAuditLogs: jest.fn(),
    };
    controller = new AuditController(auditService);
  });

  it('delegates audit log listing with query params', async () => {
    const result = { data: [], meta: { total: 0 } };
    const query = { page: 1, limit: 25, search: 'login' };
    auditService.getAuditLogs.mockResolvedValue(result);

    await expect(controller.getAuditLogs(query as any)).resolves.toBe(result);
    expect(auditService.getAuditLogs).toHaveBeenCalledWith(query);
  });
});
