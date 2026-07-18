import { NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { TenantMembersService } from './tenant-members.service';

describe('TenantMembersService', () => {
  let service: TenantMembersService;
  let prisma: {
    user: { findUnique: jest.Mock };
    tenantMembership: { findUnique: jest.Mock; create: jest.Mock };
    tenantInvitation: {
      create: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
    tenant: { findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let mailService: { sendWorkspaceInvitation: jest.Mock };
  let usersService: { createUser: jest.Mock };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      tenantMembership: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      tenantInvitation: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      tenant: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: (tx: typeof prisma) => unknown) => cb(prisma)),
    };
    mailService = {
      sendWorkspaceInvitation: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      createUser: jest.fn(),
    };

    service = new TenantMembersService(
      prisma as never,
      mailService as never,
      usersService as never,
    );
  });

  it('hashes the invite token, emails the raw token, and never returns it', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.tenantInvitation.create.mockResolvedValue({
      id: 'invite-1',
      tokenHash: 'stored-hash',
    });
    prisma.tenant.findUnique.mockResolvedValue({
      id: 'tenant-a',
      name: 'Acme',
    });

    const actualResult = await service.inviteMember(
      'tenant-a',
      { email: 'new@example.com' },
      'inviter-1',
    );

    expect(actualResult).toEqual({ message: 'Invitation sent successfully' });
    expect(actualResult).not.toHaveProperty('token');

    const createArgs = prisma.tenantInvitation.create.mock.calls[0][0] as {
      data: { tokenHash: string };
    };
    const createData = createArgs.data;
    expect(createData.tokenHash).toEqual(expect.any(String));
    expect(createData.tokenHash).toHaveLength(64);

    expect(mailService.sendWorkspaceInvitation).toHaveBeenCalledWith(
      'new@example.com',
      'Acme',
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );

    const rawToken = mailService.sendWorkspaceInvitation.mock
      .calls[0][2] as string;
    const expectedHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    expect(createData.tokenHash).toBe(expectedHash);
    expect(createData.tokenHash).not.toBe(rawToken);
  });

  it('accepts an invitation by hashing the incoming token for lookup', async () => {
    const inputRawToken = 'a'.repeat(64);
    const expectedHash = crypto
      .createHash('sha256')
      .update(inputRawToken)
      .digest('hex');

    prisma.tenantInvitation.findUnique.mockResolvedValue({
      id: 'invite-1',
      tenantId: 'tenant-a',
      email: 'member@example.com',
      role: 'member',
      invitedById: 'inviter-1',
      expiresAt: new Date(Date.now() + 60_000),
      tenant: { id: 'tenant-a', name: 'Acme' },
    });
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'member@example.com',
    });
    prisma.tenantMembership.create.mockResolvedValue({});
    prisma.tenantInvitation.delete.mockResolvedValue({});

    const actualResult = await service.acceptInvitation({
      token: inputRawToken,
    });

    expect(prisma.tenantInvitation.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: expectedHash },
      include: { tenant: true },
    });
    expect(actualResult).toEqual({
      message: 'Joined workspace successfully',
      tenantId: 'tenant-a',
    });
  });

  it('rejects acceptance when the hash does not match any invite', async () => {
    prisma.tenantInvitation.findUnique.mockResolvedValue(null);

    await expect(
      service.acceptInvitation({ token: 'unknown-token' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
