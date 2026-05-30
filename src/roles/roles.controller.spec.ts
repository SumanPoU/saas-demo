import { RolesController } from './roles.controller';

describe('RolesController', () => {
  let controller: RolesController;
  let rolesService: any;

  beforeEach(() => {
    rolesService = {
      createRole: jest.fn(),
      getAllRoles: jest.fn(),
      getUserRoles: jest.fn(),
      getRoleById: jest.fn(),
      updateRole: jest.fn(),
      deleteRole: jest.fn(),
      assignPermissionsToRole: jest.fn(),
      removePermissionsFromRole: jest.fn(),
      assignRoleToUsers: jest.fn(),
      removeRoleFromUsers: jest.fn(),
    };
    controller = new RolesController(rolesService);
  });

  it('delegates role creation with actor id', async () => {
    const dto = { name: 'Admin' };
    const result = { id: 'role-1', ...dto };
    rolesService.createRole.mockResolvedValue(result);

    await expect(
      controller.createRole(dto as any, { id: 'admin-1' }),
    ).resolves.toBe(result);
    expect(rolesService.createRole).toHaveBeenCalledWith(dto, 'admin-1');
  });

  it('delegates permission assignment with actor id', async () => {
    const result = { roleId: 'role-1', permissions: [] };
    rolesService.assignPermissionsToRole.mockResolvedValue(result);

    await expect(
      controller.assignPermissionsToRole(
        'role-1',
        { permissionIds: ['permission-1'] },
        { id: 'admin-1' },
      ),
    ).resolves.toBe(result);
    expect(rolesService.assignPermissionsToRole).toHaveBeenCalledWith(
      'role-1',
      ['permission-1'],
      'admin-1',
    );
  });

  it('delegates role assignment to users', async () => {
    const result = { roleId: 'role-1', users: [] };
    rolesService.assignRoleToUsers.mockResolvedValue(result);

    await expect(
      controller.assignRoleToUsers('role-1', { userIds: ['user-1'] }),
    ).resolves.toBe(result);
    expect(rolesService.assignRoleToUsers).toHaveBeenCalledWith('role-1', [
      'user-1',
    ]);
  });
});
