import { PermissionsController } from './permissions.controller';

describe('PermissionsController', () => {
  let controller: PermissionsController;
  let permissionsService: any;

  beforeEach(() => {
    permissionsService = {
      createPermission: jest.fn(),
      getAllPermissions: jest.fn(),
      createPermissionGroup: jest.fn(),
      getAllPermissionGroups: jest.fn(),
      getPermissionGroupById: jest.fn(),
      updatePermissionGroup: jest.fn(),
      deletePermissionGroup: jest.fn(),
      getPermissionById: jest.fn(),
      updatePermission: jest.fn(),
      deletePermission: jest.fn(),
      assignPermissionToGroup: jest.fn(),
      removePermissionFromGroup: jest.fn(),
    };
    controller = new PermissionsController(permissionsService);
  });

  it('delegates permission creation with actor id', async () => {
    const dto = { name: 'users:read' };
    const result = { id: 'permission-1', ...dto };
    permissionsService.createPermission.mockResolvedValue(result);

    await expect(
      controller.createPermission(dto as any, { id: 'admin-1' }),
    ).resolves.toBe(result);
    expect(permissionsService.createPermission).toHaveBeenCalledWith(
      dto,
      { id: 'admin-1' },
    );
  });

  it('delegates permission group creation with actor id', async () => {
    const dto = { name: 'User Management' };
    const result = { id: 'group-1', ...dto };
    permissionsService.createPermissionGroup.mockResolvedValue(result);

    await expect(
      controller.createPermissionGroup(dto as any, { id: 'admin-1' }),
    ).resolves.toBe(result);
    expect(permissionsService.createPermissionGroup).toHaveBeenCalledWith(
      dto,
      { id: 'admin-1' },
    );
  });

  it('delegates permission-group assignment body ids', async () => {
    const result = { id: 'permission-1', groups: [{ id: 'group-1' }] };
    permissionsService.assignPermissionToGroup.mockResolvedValue(result);

    await expect(
      controller.assignPermissionToGroup('permission-1', {
        groupIds: ['group-1'],
      }),
    ).resolves.toBe(result);
    expect(permissionsService.assignPermissionToGroup).toHaveBeenCalledWith(
      'permission-1',
      ['group-1'],
    );
  });
});
