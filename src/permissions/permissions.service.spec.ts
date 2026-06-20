import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let prisma: any;
  let pagination: any;

  const permission = {
    id: 'permission-1',
    name: 'users:read',
    description: 'Read users',
    groups: [],
    rolePermissions: [{ role: { id: 'role-1', name: 'Admin' } }],
  };

  beforeEach(() => {
    prisma = {
      permission: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      permissionGroup: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      rolePermission: {
        count: jest.fn(),
      },
    };
    pagination = {
      paginate: jest.fn(),
    };

    service = new PermissionsService(prisma, pagination);
  });

  it('creates a permission and flattens roles from rolePermissions', async () => {
    prisma.permission.findFirst.mockResolvedValue(null);
    prisma.permission.create.mockResolvedValue(permission);

    const result = await service.createPermission(
      { name: 'users:read', description: 'Read users' },
      { id: 'admin-1' },
    );

    expect(result).toMatchObject({
      id: 'permission-1',
      roles: [{ id: 'role-1', name: 'Admin' }],
    });
    expect(prisma.permission.create).toHaveBeenCalledWith({
      data: {
        name: 'users:read',
        description: 'Read users',
        createdBy: 'admin-1',
      },
      include: expect.any(Object),
    });
  });

  it('rejects duplicate permission names', async () => {
    prisma.permission.findFirst.mockResolvedValue(permission);

    await expect(
      service.createPermission({ name: 'users:read' }, { id: 'admin-1' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.permission.create).not.toHaveBeenCalled();
  });

  it('blocks deleting permissions assigned to roles', async () => {
    prisma.permission.findFirst.mockResolvedValue(permission);
    prisma.rolePermission.count.mockResolvedValue(2);

    await expect(
      service.deletePermission('permission-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.permission.delete).not.toHaveBeenCalled();
  });

  it('assigns permission to groups only when all group ids exist', async () => {
    prisma.permission.findFirst.mockResolvedValue(permission);
    prisma.permissionGroup.findMany.mockResolvedValue([{ id: 'group-1' }]);

    await expect(
      service.assignPermissionToGroup('permission-1', ['group-1', 'missing']),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.permission.update).not.toHaveBeenCalled();

    prisma.permissionGroup.findMany.mockResolvedValue([
      { id: 'group-1' },
      { id: 'group-2' },
    ]);
    prisma.permission.update.mockResolvedValue({
      id: 'permission-1',
      groups: [{ id: 'group-1' }, { id: 'group-2' }],
    });

    await service.assignPermissionToGroup('permission-1', [
      'group-1',
      'group-2',
    ]);

    expect(prisma.permission.update).toHaveBeenCalledWith({
      where: { id: 'permission-1' },
      data: {
        groups: {
          connect: [{ id: 'group-1' }, { id: 'group-2' }],
        },
      },
      include: { groups: true },
    });
  });

  it('throws NotFoundException for missing permission groups', async () => {
    prisma.permissionGroup.findUnique.mockResolvedValue(null);

    await expect(
      service.getPermissionGroupById('missing-group'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
