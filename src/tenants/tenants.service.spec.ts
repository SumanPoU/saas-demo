import { NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { TenantsService } from './tenants.service';

describe('TenantsService', () => {
  let service: TenantsService;
  let prisma: {
    tenant: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    tenantMembership: {
      create: jest.Mock;
      findFirst: jest.Mock;
    };
    user: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let mailService: { sendTenantRestorationEmail: jest.Mock };

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      tenantMembership: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(async (cb: (tx: typeof prisma) => unknown) =>
        cb(prisma),
      ),
    };
    mailService = {
      sendTenantRestorationEmail: jest.fn().mockResolvedValue(undefined),
    };
    service = new TenantsService(prisma as never, mailService as never);
  });

  it('soft-deletes a tenant, stores a hashed restoration token, and emails the raw token', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-a',
      name: 'Acme',
      deletedAt: null,
    });
    prisma.tenantMembership.findFirst.mockResolvedValue({
      isOwner: true,
      user: { id: 'owner-1', email: 'owner@example.com' },
    });
    prisma.tenant.update.mockResolvedValue({});

    const actualResult = await service.remove('tenant-a', 'owner-1');

    expect(actualResult).toEqual({
      message:
        'Workspace deleted successfully. A restoration token has been emailed to the owner.',
    });
    expect(actualResult).not.toHaveProperty('token');

    const updateData = prisma.tenant.update.mock.calls[0][0].data as {
      restorationToken: string;
      deletedAt: Date;
      isActive: boolean;
    };
    expect(updateData.isActive).toBe(false);
    expect(updateData.deletedAt).toEqual(expect.any(Date));
    expect(updateData.restorationToken).toHaveLength(64);

    expect(mailService.sendTenantRestorationEmail).toHaveBeenCalledWith(
      'owner@example.com',
      'Acme',
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );

    const rawToken = mailService.sendTenantRestorationEmail.mock
      .calls[0][2] as string;
    const expectedHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    expect(updateData.restorationToken).toBe(expectedHash);
  });

  it('restores a soft-deleted tenant when the restoration token hash matches', async () => {
    const inputRawToken = 'b'.repeat(64);
    const expectedHash = crypto
      .createHash('sha256')
      .update(inputRawToken)
      .digest('hex');

    prisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-a',
      deletionRequestedAt: new Date(),
      deletedAt: new Date(),
      restorationToken: expectedHash,
    });
    prisma.tenant.update.mockResolvedValue({
      id: 'tenant-a',
      deletedAt: null,
      isActive: true,
    });

    const actualTenant = await service.restore({ token: inputRawToken });

    expect(prisma.tenant.findFirst).toHaveBeenCalledWith({
      where: {
        restorationToken: expectedHash,
        deletedAt: { not: null },
      },
    });
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-a' },
      data: {
        deletedAt: null,
        deletionRequestedAt: null,
        restorationToken: null,
        isActive: true,
      },
    });
    expect(actualTenant).toMatchObject({ id: 'tenant-a', isActive: true });
  });

  it('rejects restore when the token does not match any deleted tenant', async () => {
    prisma.tenant.findFirst.mockResolvedValue(null);

    await expect(
      service.restore({ token: 'unknown-token' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects restore when the 30-day restoration window has expired', async () => {
    const inputRawToken = 'c'.repeat(64);
    const expectedHash = crypto
      .createHash('sha256')
      .update(inputRawToken)
      .digest('hex');

    prisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-a',
      restorationToken: expectedHash,
      deletedAt: new Date(),
      deletionRequestedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000),
    });

    await expect(
      service.restore({ token: inputRawToken }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});
