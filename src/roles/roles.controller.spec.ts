import { RolesController } from './roles.controller';

describe('RolesController', () => {
  let controller: RolesController;
  let rolesService: {
    createRole: jest.Mock;
    getAllRoles: jest.Mock;
    getUserRoles: jest.Mock;
    getRoleById: jest.Mock;
    updateRole: jest.Mock;
    deleteRole: jest.Mock;
    assignPermissionsToRole: jest.Mock;
    removePermissionsFromRole: jest.Mock;
    assignRoleToUsers: jest.Mock;
    removeRoleFromUsers: jest.Mock;
  };

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
    controller = new RolesController(rolesService as never);
  });

  it('delegates role creation with the full actor user', async () => {
    const dto = { name: 'Admin' };
    const inputUser = { id: 'admin-1', tenantId: 'tenant-a' };
    const result = { id: 'role-1', ...dto };
    rolesService.createRole.mockResolvedValue(result);

    await expect(controller.createRole(dto as never, inputUser)).resolves.toBe(
      result,
    );
    expect(rolesService.createRole).toHaveBeenCalledWith(dto, inputUser);
  });

  it('delegates permission assignment with actor user', async () => {
    const result = { roleId: 'role-1', permissions: [] };
    const inputUser = { id: 'admin-1', tenantId: 'tenant-a' };
    rolesService.assignPermissionsToRole.mockResolvedValue(result);

    await expect(
      controller.assignPermissionsToRole(
        'role-1',
        { permissionIds: ['permission-1'] },
        inputUser,
      ),
    ).resolves.toBe(result);
    expect(rolesService.assignPermissionsToRole).toHaveBeenCalledWith(
      'role-1',
      ['permission-1'],
      inputUser,
      'admin-1',
    );
  });

  it('delegates role assignment to users with actor user', async () => {
    const result = { roleId: 'role-1', users: [] };
    const inputUser = { id: 'admin-1', tenantId: 'tenant-a' };
    rolesService.assignRoleToUsers.mockResolvedValue(result);

    await expect(
      controller.assignRoleToUsers(
        'role-1',
        { userIds: ['user-1'] },
        inputUser,
      ),
    ).resolves.toBe(result);
    expect(rolesService.assignRoleToUsers).toHaveBeenCalledWith(
      'role-1',
      ['user-1'],
      inputUser,
    );
  });
});
