import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { MfaService } from './mfa.service';

jest.mock('otplib', () => ({
  authenticator: {
    options: {},
    generateSecret: jest.fn(),
    keyuri: jest.fn(),
    verify: jest.fn(),
  },
}));

jest.mock('qrcode', () => ({
  toDataURL: jest.fn(),
}));

describe('MfaService', () => {
  let service: MfaService;
  let prisma: any;
  let config: any;
  let jwtService: any;
  let mailService: any;
  let runtimeConfig: any;
  let authService: any;

  const encryptionKey = 'a'.repeat(64);

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn((operations) => Promise.all(operations)),
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      mfaConfig: {
        upsert: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      mfaBackupCode: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 8 }),
        findMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      emailVerificationToken: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      mfaRecoveryToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };
    config = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          'mfa.encryptionKey': encryptionKey,
          appName: 'DemoApp',
          'jwt.secret': 'jwt-secret',
          frontendUrl: 'http://localhost:3000',
        };
        return values[key];
      }),
    };
    jwtService = {
      verifyAsync: jest.fn(),
    };
    mailService = {
      sendEmail: jest.fn(),
    };
    runtimeConfig = {
      getBcryptSaltRounds: jest.fn().mockResolvedValue(10),
      getString: jest.fn((key: string) => {
        const values: Record<string, string> = {
          APP_NAME: 'DemoApp',
          FRONTEND_URL: 'http://localhost:3000',
        };
        return Promise.resolve(values[key]);
      }),
    };
    authService = {
      establishSessionAndIssueTokens: jest.fn(),
    };

    (authenticator.generateSecret as jest.Mock).mockReturnValue('TOTPSECRET');
    (authenticator.keyuri as jest.Mock).mockReturnValue(
      'otpauth://totp/DemoApp:user@example.com',
    );
    (authenticator.verify as jest.Mock).mockReturnValue(true);
    (QRCode.toDataURL as jest.Mock).mockResolvedValue(
      'data:image/png;base64,qr',
    );

    service = new MfaService(
      prisma,
      config,
      jwtService,
      mailService,
      runtimeConfig,
      authService,
    );
  });

  it('initiates MFA setup with encrypted secret and QR code', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
    });

    const result = await service.setup('user-1');

    expect(result).toEqual({
      success: true,
      message: 'MFA setup initiated. Scan the QR code to proceed.',
      data: {
        qrCode: 'data:image/png;base64,qr',
        secret: 'TOTPSECRET',
      },
    });
    expect(prisma.mfaConfig.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: expect.objectContaining({
        method: 'totp',
        isEnabled: false,
        totpSecret: expect.stringMatching(/^[a-f0-9]+:[a-f0-9]+$/),
        totpVerifiedAt: null,
      }),
      create: expect.objectContaining({
        userId: 'user-1',
        method: 'totp',
        isEnabled: false,
        totpSecret: expect.stringMatching(/^[a-f0-9]+:[a-f0-9]+$/),
      }),
    });
  });

  it('verifies MFA login with a backup code and delegates token issuing to AuthService', async () => {
    const backupCode = 'ABCDEF1234';
    const codeHash = await bcrypt.hash(backupCode, 10);
    jwtService.verifyAsync.mockResolvedValue({
      type: 'mfa_pending',
      sub: 'user-1',
    });
    prisma.mfaConfig.findUnique.mockResolvedValue({
      id: 'mfa-1',
      userId: 'user-1',
      isEnabled: true,
      totpSecret: null,
    });
    prisma.mfaBackupCode.findMany.mockResolvedValue([
      { id: 'backup-1', codeHash },
    ]);
    prisma.mfaBackupCode.update.mockResolvedValue({});
    prisma.mfaBackupCode.count.mockResolvedValue(0);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      roles: [],
    });
    authService.establishSessionAndIssueTokens.mockResolvedValue({
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
    });

    const result = await service.verifyLogin(
      'mfa-pending-token',
      backupCode,
      '127.0.0.1',
      'Jest Agent',
    );

    expect(result).toEqual({
      success: true,
      message: 'MFA successfully authenticated.',
      data: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        warning:
          'You have used your last backup code. Please regenerate backup codes immediately.',
      },
    });
    expect(prisma.mfaBackupCode.update).toHaveBeenCalledWith({
      where: { id: 'backup-1' },
      data: {
        isUsed: true,
        usedAt: expect.any(Date),
      },
    });
    expect(authService.establishSessionAndIssueTokens).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user-1' }),
      '127.0.0.1',
      'Jest Agent',
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        tenantId: 'default',
        actorId: 'user-1',
        action: 'mfa_verified',
        entityType: 'user',
        entityId: 'user-1',
      },
    });
  });

  it('rejects invalid MFA pending token scopes', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      type: 'access',
      sub: 'user-1',
    });

    await expect(
      service.verifyLogin('not-mfa-token', '123456'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('authorizes a verified device token and writes an audit log', async () => {
    const token = 'device-token';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    prisma.emailVerificationToken.findFirst.mockResolvedValue({
      id: 'email-token-1',
      userId: 'user-1',
      tokenHash,
    });

    await expect(service.verifyDevice(token)).resolves.toEqual({
      success: true,
      message: 'Device authorized successfully. You may now return to log in.',
    });

    expect(prisma.emailVerificationToken.findFirst).toHaveBeenCalledWith({
      where: {
        tokenHash,
        isUsed: false,
        expiresAt: { gt: expect.any(Date) },
        purpose: 'device_verify',
      },
    });
    expect(prisma.emailVerificationToken.update).toHaveBeenCalledWith({
      where: { id: 'email-token-1' },
      data: {
        isUsed: true,
        usedAt: expect.any(Date),
      },
    });
  });

  it('rejects disabling MFA when it is not enabled', async () => {
    prisma.mfaConfig.findUnique.mockResolvedValue({
      id: 'mfa-1',
      userId: 'user-1',
      isEnabled: false,
      totpSecret: null,
    });

    await expect(service.disable('user-1', '123456')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('starts MFA recovery without revealing whether inactive users exist', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.recover('missing@example.com')).resolves.toEqual({
      success: true,
      message: 'If that email exists, a recovery link was sent.',
    });

    expect(prisma.mfaRecoveryToken.create).not.toHaveBeenCalled();
    expect(mailService.sendEmail).not.toHaveBeenCalled();
  });
});
