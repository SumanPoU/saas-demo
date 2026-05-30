import { AuthController } from './auth.controller';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;

  const req = {
    ip: '127.0.0.1',
    headers: {
      'user-agent': 'Jest Agent',
    },
  };

  beforeEach(() => {
    authService = {
      registerInitiate: jest.fn(),
      resendOtp: jest.fn(),
      registerVerifyOtp: jest.fn(),
      registerComplete: jest.fn(),
      login: jest.fn(),
      setRequiredPassword: jest.fn(),
      refresh: jest.fn(),
      logout: jest.fn(),
      forgotPassword: jest.fn(),
      resetPasswordVerify: jest.fn(),
      resetPasswordComplete: jest.fn(),
      googleLogin: jest.fn(),
      githubLogin: jest.fn(),
      getProfile: jest.fn(),
      changePassword: jest.fn(),
    };
    controller = new AuthController(authService);
  });

  it('delegates registration initiation', async () => {
    const dto = { email: 'new.user@example.com' };
    const result = { userId: 'user-1' };
    authService.registerInitiate.mockResolvedValue(result);

    await expect(controller.registerInitiate(dto as any)).resolves.toBe(result);
    expect(authService.registerInitiate).toHaveBeenCalledWith(dto);
  });

  it('delegates login with request IP and user agent', async () => {
    const dto = { identifier: 'admin@example.com', password: 'Password123!' };
    const result = { tokens: {} };
    authService.login.mockResolvedValue(result);

    await expect(controller.login(dto, req)).resolves.toBe(result);
    expect(authService.login).toHaveBeenCalledWith(
      dto,
      '127.0.0.1',
      'Jest Agent',
    );
  });

  it('delegates required password setup with request metadata', async () => {
    const dto = {
      passwordChangeToken: 'token',
      newPassword: 'NewPassword123!',
      confirmPassword: 'NewPassword123!',
    };
    const result = { success: true };
    authService.setRequiredPassword.mockResolvedValue(result);

    await expect(controller.setRequiredPassword(dto, req)).resolves.toBe(
      result,
    );
    expect(authService.setRequiredPassword).toHaveBeenCalledWith(
      dto,
      '127.0.0.1',
      'Jest Agent',
    );
  });

  it('delegates logout using current session and actor id', async () => {
    const result = { success: true };
    authService.logout.mockResolvedValue(result);

    await expect(
      controller.logout({ id: 'user-1', sessionId: 'session-1' }, req),
    ).resolves.toBe(result);
    expect(authService.logout).toHaveBeenCalledWith(
      'session-1',
      'user-1',
      '127.0.0.1',
      'Jest Agent',
    );
  });

  it('delegates forgot and reset password flows', async () => {
    authService.forgotPassword.mockResolvedValue({ success: true });
    authService.resetPasswordVerify.mockResolvedValue({ success: true });
    authService.resetPasswordComplete.mockResolvedValue({ success: true });

    await controller.forgotPassword({ identifier: 'user@example.com' }, req);
    await controller.resetPasswordVerify({
      identifier: 'user@example.com',
      otp: '123456',
    });
    await controller.resetPasswordComplete(
      {
        identifier: 'user@example.com',
        code: '123456',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      },
      req,
    );

    expect(authService.forgotPassword).toHaveBeenCalledWith(
      { identifier: 'user@example.com' },
      '127.0.0.1',
      'Jest Agent',
    );
    expect(authService.resetPasswordVerify).toHaveBeenCalledWith({
      identifier: 'user@example.com',
      otp: '123456',
    });
    expect(authService.resetPasswordComplete).toHaveBeenCalledWith(
      {
        identifier: 'user@example.com',
        code: '123456',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      },
      '127.0.0.1',
      'Jest Agent',
    );
  });

  it('delegates OAuth and profile/password actions', async () => {
    authService.googleLogin.mockResolvedValue({ provider: 'google' });
    authService.githubLogin.mockResolvedValue({ provider: 'github' });
    authService.getProfile.mockResolvedValue({ id: 'user-1' });
    authService.changePassword.mockResolvedValue({ success: true });

    await controller.googleLogin(
      { code: 'code', state: 's', expectedState: 's' },
      req,
    );
    await controller.githubLogin(
      { code: 'code', state: 's', expectedState: 's' },
      req,
    );
    await controller.getProfile({ id: 'user-1' });
    await controller.changePassword(
      { id: 'user-1', sessionId: 'session-1' },
      req,
      {
        currentPassword: 'CurrentPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      },
    );

    expect(authService.googleLogin).toHaveBeenCalledWith(
      'code',
      's',
      's',
      '127.0.0.1',
      'Jest Agent',
    );
    expect(authService.githubLogin).toHaveBeenCalledWith(
      'code',
      's',
      's',
      '127.0.0.1',
      'Jest Agent',
    );
    expect(authService.getProfile).toHaveBeenCalledWith('user-1');
    expect(authService.changePassword).toHaveBeenCalledWith(
      'user-1',
      'session-1',
      {
        currentPassword: 'CurrentPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      },
    );
  });
});
