import { MfaController } from './mfa.controller';

describe('MfaController', () => {
  let controller: MfaController;
  let mfaService: any;

  beforeEach(() => {
    mfaService = {
      setup: jest.fn(),
      verifySetup: jest.fn(),
      regenerateBackupCodes: jest.fn(),
      verifyLogin: jest.fn(),
      verifyDevice: jest.fn(),
      disable: jest.fn(),
      recover: jest.fn(),
      verifyRecovery: jest.fn(),
    };
    controller = new MfaController(mfaService);
  });

  it('delegates setup with the current user id', async () => {
    const result = { success: true };
    mfaService.setup.mockResolvedValue(result);

    await expect(controller.setup({ id: 'user-1' })).resolves.toBe(result);
    expect(mfaService.setup).toHaveBeenCalledWith('user-1');
  });

  it('delegates MFA login with request metadata', async () => {
    const result = { success: true };
    mfaService.verifyLogin.mockResolvedValue(result);

    await expect(
      controller.verifyLogin(
        { mfaPendingToken: 'pending-token', code: '123456' },
        {
          ip: '127.0.0.1',
          headers: { 'user-agent': 'Jest Agent' },
        },
      ),
    ).resolves.toBe(result);

    expect(mfaService.verifyLogin).toHaveBeenCalledWith(
      'pending-token',
      '123456',
      '127.0.0.1',
      'Jest Agent',
    );
  });

  it('delegates disable with the current user id and confirmation code', async () => {
    const result = { success: true };
    mfaService.disable.mockResolvedValue(result);

    await expect(
      controller.disable({ id: 'user-1' }, { code: '123456' }),
    ).resolves.toBe(result);
    expect(mfaService.disable).toHaveBeenCalledWith('user-1', '123456');
  });
});
