import { MailService } from './mail.service';
import { MailProvider } from './mail-provider.interface';

describe('MailService', () => {
  let service: MailService;
  let mailProvider: { sendEmail: jest.Mock };

  beforeEach(() => {
    mailProvider = {
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };
    service = new MailService(mailProvider as unknown as MailProvider);
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

  it('sends tenant restoration email through the common sendEmail helper', async () => {
    const sendEmail = jest
      .spyOn(service, 'sendEmail')
      .mockResolvedValue(undefined);
    const inputToken = 'd'.repeat(64);

    await service.sendTenantRestorationEmail(
      'owner@example.com',
      'Acme',
      inputToken,
    );

    expect(sendEmail).toHaveBeenCalledWith(
      'owner@example.com',
      'Restore your workspace: Acme',
      expect.stringContaining(inputToken),
      expect.stringContaining(inputToken),
    );
  });

  it('delegates sendEmail to the injected mail provider', async () => {
    await service.sendEmail('a@b.c', 'Subject', 'text', '<p>html</p>');

    expect(mailProvider.sendEmail).toHaveBeenCalledWith(
      'a@b.c',
      'Subject',
      'text',
      '<p>html</p>',
    );
  });
});
