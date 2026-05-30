import { UsersController } from './users.controller';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: any;

  beforeEach(() => {
    usersService = {
      createUser: jest.fn(),
      getUsers: jest.fn(),
      getUserById: jest.fn(),
      updateUser: jest.fn(),
      resetUserPassword: jest.fn(),
      deleteUser: jest.fn(),
    };
    controller = new UsersController(usersService);
  });

  it('delegates create user with the current actor id', async () => {
    const dto = { email: 'new.user@example.com' };
    const created = { id: 'user-1', email: dto.email };
    usersService.createUser.mockResolvedValue(created);

    await expect(
      controller.createUser(dto as any, { id: 'admin-1' }),
    ).resolves.toBe(created);
    expect(usersService.createUser).toHaveBeenCalledWith(dto, 'admin-1');
  });

  it('delegates admin password reset with the current actor id', async () => {
    const updated = { id: 'user-1', mustChangePassword: true };
    usersService.resetUserPassword.mockResolvedValue(updated);

    await expect(
      controller.resetUserPassword('user-1', { id: 'admin-1' }),
    ).resolves.toBe(updated);
    expect(usersService.resetUserPassword).toHaveBeenCalledWith(
      'user-1',
      'admin-1',
    );
  });

  it('delegates soft delete with the current actor id', async () => {
    const deleted = { id: 'user-1', isActive: false };
    usersService.deleteUser.mockResolvedValue(deleted);

    await expect(
      controller.deleteUser('user-1', { id: 'admin-1' }),
    ).resolves.toBe(deleted);
    expect(usersService.deleteUser).toHaveBeenCalledWith('user-1', 'admin-1');
  });
});
