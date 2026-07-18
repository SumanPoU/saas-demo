import { NotFoundException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { TenantsService } from './tenants.service';
import { TenantsRepository } from './tenants.repository';

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
    const repository = new TenantsRepository(prisma as never);
    service = new TenantsService(repository, mailService as never);
  });

  it('soft-deletes a tenant, stores a hashed restoration token, and emails the raw token', async () => {
    prisma.tenant.findFirst.mockResolvedValue({
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

    const emailedRaw = mailService.sendTenantRestorationEmail.mock
      .calls[0][2] as string;
    expect(updateData.restorationToken).toBe(
      crypto.createHash('sha256').update(emailedRaw).digest('hex'),
    );
  });

  it('restores a soft-deleted tenant when the token hash matches', async () => {
    const rawToken = 'b'.repeat(64);
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');

    prisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-a',
      name: 'Acme',
      deletedAt: new Date(),
      deletionRequestedAt: new Date(),
      restorationToken: tokenHash,
    });
    prisma.tenant.update.mockResolvedValue({
      id: 'tenant-a',
      name: 'Acme',
      slug: 'acme',
      isActive: true,
      deletedAt: null,
      restorationToken: null,
      migrationVersion: 1,
      schemaVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const actual = await service.restore({ token: rawToken });

    expect(actual).toMatchObject({
      id: 'tenant-a',
      isActive: true,
      deletedAt: null,
    });
    expect(Object.keys(actual as object)).not.toContain('restorationToken');
    expect(Object.keys(actual as object)).not.toContain('schemaName');
    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-a' },
      data: {
        deletedAt: null,
        deletionRequestedAt: null,
        restorationToken: null,
        isActive: true,
      },
    });
  });

  it('rejects restore when the token is unknown', async () => {
    prisma.tenant.findFirst.mockResolvedValue(null);

    await expect(
      service.restore({ token: 'unknown-token' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects restore when the 30-day window has expired', async () => {
    const rawToken = 'c'.repeat(64);
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expired = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

    prisma.tenant.findFirst.mockResolvedValue({
      id: 'tenant-a',
      deletionRequestedAt: expired,
      restorationToken: tokenHash,
      deletedAt: expired,
    });

    await expect(service.restore({ token: rawToken })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
