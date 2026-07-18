import { ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

describe('MailService', () => {
  let service: MailService;

  beforeEach(() => {
    service = new MailService(
      {
        get: jest.fn((key: string) => {
          const values: Record<string, string | number> = {
            'mail.host': 'localhost',
            'mail.port': 587,
            'mail.user': 'mock-user',
            'mail.pass': '',
            'mail.from': '"Demo" <noreply@example.com>',
          };
          return values[key];
        }),
      } as unknown as ConfigService,
      {
        getString: jest.fn(),
        getNumber: jest.fn(),
      } as any,
    );
  });

  it('sends temporary password email through the common sendEmail helper', async () => {
    const sendEmail = jest
      .spyOn(service, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.sendTemporaryPassword(
      'user@example.com',
      'Temp-Password123!',
      'User',
    );

    expect(sendEmail).toHaveBeenCalledWith(
      'user@example.com',
      'Your Temporary Account Password',
      expect.stringContaining('Temp-Password123!'),
      expect.stringContaining('Temp-Password123!'),
    );
  });

  it('sends password reset OTP email through the common sendEmail helper', async () => {
    const sendEmail = jest
      .spyOn(service, 'sendEmail')
      .mockResolvedValue(undefined);

    await service.sendPasswordResetOtp('user@example.com', '123456');

    expect(sendEmail).toHaveBeenCalledWith(
      'user@example.com',
      'Reset Your Password',
      expect.stringContaining('123456'),
      expect.stringContaining('123456'),
    );
  });

  it('sends workspace invitation email through the common sendEmail helper', async () => {
    const sendEmail = jest
      .spyOn(service, 'sendEmail')
      .mockResolvedValue(undefined);
    const inputToken = 'a'.repeat(64);

    await service.sendWorkspaceInvitation(
      'invitee@example.com',
      'Acme Workspace',
      inputToken,
    );

    expect(sendEmail).toHaveBeenCalledWith(
      'invitee@example.com',
      "You're invited to join Acme Workspace",
      expect.stringContaining(inputToken),
      expect.stringContaining(inputToken),
    );
  });
});
