import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: any;

  const role = {
    id: 'role-1',
    name: 'Admin',
    description: 'Admin role',
    isDefault: false,
    rolePermissions: [
      { permission: { id: 'permission-1', name: 'users:read' } },
    ],
    users: [],
  };

  beforeEach(() => {
    prisma = {
      role: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      user: {
        count: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
      permission: {
        findMany: jest.fn(),
      },
      rolePermission: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
    };

    service = new RolesService(prisma);
  });

  it('creates a role and flattens permissions from rolePermissions', async () => {
    prisma.role.findFirst.mockResolvedValue(null);
    prisma.role.findFirst.mockResolvedValue(null);
    prisma.role.create.mockResolvedValue(role);

    const result = await service.createRole(
      {
        name: 'Admin',
        description: 'Admin role',
        isDefault: true,
      },
      { id: 'admin-1', isSuperAdmin: true, tenantId: null },
    );

    expect(result).toMatchObject({
      id: 'role-1',
      permissions: [{ id: 'permission-1', name: 'users:read' }],
    });
    expect(prisma.role.create).toHaveBeenCalledWith({
      data: {
        name: 'Admin',
        description: 'Admin role',
        isDefault: true,
        tenantId: null,
      },
      include: expect.any(Object),
    });
  });

  it('enforces only one default role', async () => {
    prisma.role.findFirst.mockResolvedValue(null);
    prisma.role.findFirst.mockResolvedValue({
      id: 'role-default',
      name: 'User',
      isDefault: true,
    });

    await expect(
      service.createRole(
        { name: 'Member', isDefault: true },
        { id: 'admin-1', isSuperAdmin: true, tenantId: null },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.role.create).not.toHaveBeenCalled();
  });

  it('blocks deleting roles assigned to users', async () => {
    prisma.role.findFirst.mockResolvedValue(role);
    prisma.user.count.mockResolvedValue(3);

    await expect(
      service.deleteRole('role-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it('assigns permissions to a role with idempotent upserts', async () => {
    prisma.role.findFirst.mockResolvedValue(role);
    prisma.permission.findMany.mockResolvedValue([
      { id: 'permission-1', name: 'users:read' },
      { id: 'permission-2', name: 'users:create' },
    ]);
    prisma.rolePermission.upsert
      .mockResolvedValueOnce({
        permission: { id: 'permission-1', name: 'users:read' },
      })
      .mockResolvedValueOnce({
        permission: { id: 'permission-2', name: 'users:create' },
      });

    const result = await service.assignPermissionsToRole(
      'role-1',
      ['permission-1', 'permission-2'],
      'admin-1',
    );

    expect(result.permissions).toEqual([
      { id: 'permission-1', name: 'users:read' },
      { id: 'permission-2', name: 'users:create' },
    ]);
    expect(prisma.rolePermission.upsert).toHaveBeenCalledWith({
      where: {
        roleId_permissionId: {
          roleId: 'role-1',
          permissionId: 'permission-1',
        },
      },
      create: {
        roleId: 'role-1',
        permissionId: 'permission-1',
        assignedById: 'admin-1',
      },
      update: {},
      include: {
        permission: true,
        assignedBy: { select: { id: true, username: true } },
      },
    });
  });

  it('rejects assigning missing permission ids', async () => {
    prisma.role.findFirst.mockResolvedValue(role);
    prisma.permission.findMany.mockResolvedValue([{ id: 'permission-1' }]);

    await expect(
      service.assignPermissionsToRole(
        'role-1',
        ['permission-1', 'missing'],
        'admin-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.rolePermission.upsert).not.toHaveBeenCalled();
  });

  it('returns false when checking roles for a missing user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.checkUserHasRole('missing-user', ['Admin']),
    ).resolves.toBe(false);
  });

  it('throws NotFoundException for missing roles', async () => {
    prisma.role.findFirst.mockResolvedValue(null);

    await expect(
      service.getRoleById('missing-role', { id: 'admin-1' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
