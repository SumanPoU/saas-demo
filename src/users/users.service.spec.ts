import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: any;
  let usersRepository: UsersRepository;
  let pagination: any;
  let mailService: any;
  let runtimeConfig: any;
  let mediaService: any;

  const safeUser = {
    id: 'user-1',
    email: 'new.user@example.com',
    username: 'newuser',
    firstName: 'New',
    lastName: 'User',
    mustChangePassword: true,
    isActive: true,
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      role: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      userSession: {
        updateMany: jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };
    usersRepository = new UsersRepository(prisma);
    pagination = {
      paginate: jest.fn(),
    };
    mailService = {
      sendTemporaryPassword: jest.fn(),
    };
    runtimeConfig = {
      getBcryptSaltRounds: jest.fn().mockResolvedValue(10),
    };
    mediaService = {
      uploadFile: jest.fn(),
    };

    service = new UsersService(
      usersRepository,
      pagination,
      mailService,
      runtimeConfig,
      mediaService,
    );
  });

  it('creates a user with a generated temporary password and requires password change', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.role.findFirst.mockResolvedValue({
      id: 'role-default',
      isDefault: true,
    });
    prisma.user.create.mockResolvedValue(safeUser);

    const result = await service.createUser(
      {
        email: 'New.User@Example.COM',
        firstName: 'New',
        lastName: 'User',
      },
      'admin-1',
    );

    expect(result).toMatchObject(safeUser);
    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ email: 'new.user@example.com' }, { username: 'newuser' }],
      },
      select: { email: true, username: true },
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'new.user@example.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        passwordHash: expect.any(String),
        passwordChangedAt: expect.any(Date),
        mustChangePassword: true,
        isActive: true,
        emailVerified: true,
        roles: { connect: [{ id: 'role-default' }] },
      }),
      select: expect.any(Object),
    });
    expect(prisma.user.create.mock.calls[0][0].data).not.toHaveProperty(
      'password',
    );
    expect(mailService.sendTemporaryPassword).toHaveBeenCalledWith(
      safeUser.email,
      expect.stringMatching(/^Temp-.+1!$/),
      safeUser.firstName,
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-1',
        action: 'USER_CREATE',
        entityId: safeUser.id,
      }),
    });
  });

  it('rejects duplicate email or username during user creation', async () => {
    prisma.user.findFirst.mockResolvedValue({
      email: 'new.user@example.com',
      username: 'newuser',
    });

    await expect(
      service.createUser({ email: 'new.user@example.com' }, 'admin-1'),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('rejects role IDs that do not exist', async () => {
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.role.findMany.mockResolvedValue([{ id: 'role-1' }]);

    await expect(
      service.createUser(
        {
          email: 'new.user@example.com',
          roleIds: ['role-1', 'missing-role'],
        },
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('resets a user password, revokes active sessions, and emails the temporary password', async () => {
    prisma.user.findFirst
      .mockResolvedValueOnce(safeUser)
      .mockResolvedValueOnce({ ...safeUser, mustChangePassword: true });

    const result = await service.resetUserPassword('user-1', { id: 'admin-1' });

    expect(result).toMatchObject({ id: 'user-1', mustChangePassword: true });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        passwordHash: expect.any(String),
        passwordChangedAt: expect.any(Date),
        mustChangePassword: true,
      },
    });
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: expect.any(Date),
        revokedBy: 'admin-1',
      },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: expect.any(Date),
      },
    });
    expect(mailService.sendTemporaryPassword).toHaveBeenCalledWith(
      safeUser.email,
      expect.stringMatching(/^Temp-.+1!$/),
      safeUser.firstName,
    );
  });

  it('soft-deletes users but refuses to delete the acting user', async () => {
    await expect(
      service.deleteUser('admin-1', { id: 'admin-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.user.update).not.toHaveBeenCalled();

    prisma.user.findFirst.mockResolvedValue(safeUser);
    prisma.user.update.mockResolvedValue({ ...safeUser, isActive: false });

    const result = await service.deleteUser('user-1', { id: 'admin-1' });

    expect(result.isActive).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isActive: false },
      select: expect.any(Object),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: 'admin-1',
        action: 'USER_DELETE',
        entityId: 'user-1',
      }),
    });
  });

  it('throws NotFoundException when a user is not found', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.deleteUser('user-1', { id: 'admin-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
