import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: any;
  let jwtService: any;
  let configService: any;
  let mailService: any;

  const activeTempUser = {
    id: 'user-1',
    email: 'temp.user@example.com',
    username: 'tempuser',
    firstName: 'Temp',
    isActive: true,
    mustChangePassword: true,
    passwordHash: '',
    roles: [],
  };

  const authPayloadUser = {
    id: 'user-1',
    username: 'tempuser',
    email: 'temp.user@example.com',
    firstName: 'Temp',
    lastName: 'User',
    avatarUrl: null,
    isActive: true,
    isSuperAdmin: false,
    mustChangePassword: false,
    roles: [
      {
        name: 'User',
        rolePermissions: [
          {
            permission: {
              id: 'permission-1',
              name: 'users:read',
            },
          },
        ],
      },
    ],
  };

  beforeEach(() => {
    prisma = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      role: {
        findFirst: jest.fn(),
      },
      emailVerificationToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      passwordResetToken: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      mfaConfig: {
        findUnique: jest.fn(),
      },
      userSession: {
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      refreshToken: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
    };
    jwtService = {
      signAsync: jest
        .fn()
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token'),
      verifyAsync: jest.fn(),
    };
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string> = {
          'jwt.secret': 'jwt-secret',
          'jwt.refreshSecret': 'refresh-secret',
          'jwt.expiresIn': '15m',
          'jwt.refreshExpiresIn': '7d',
        };
        return values[key];
      }),
    };
    mailService = {
      sendRegistrationOtp: jest.fn(),
      sendEmailVerifiedNotification: jest.fn(),
      sendWelcomeNotification: jest.fn(),
      sendPasswordResetOtp: jest.fn(),
      sendPasswordResetSuccessNotification: jest.fn(),
    };

    service = new AuthService(prisma, jwtService, configService, mailService);
  });

  it('returns a password-change next step instead of tokens for temporary-password login', async () => {
    const passwordHash = await bcrypt.hash('TempPassword123!', 10);
    prisma.user.findFirst.mockResolvedValue({
      ...activeTempUser,
      passwordHash,
    });

    const result = await service.login(
      { identifier: 'TEMP.USER@EXAMPLE.COM', password: 'TempPassword123!' },
      '127.0.0.1',
      'Jest Agent',
    );

    expect(result).toMatchObject({
      success: false,
      requiresPasswordChange: true,
      nextStep: {
        action: 'SET_PASSWORD',
        method: 'POST',
        endpoint: '/auth/set-required-password',
      },
    });
    expect(result).toHaveProperty('passwordChangeToken');
    expect(result).not.toHaveProperty('tokens');
    expect(prisma.passwordResetToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: activeTempUser.id,
        tenantId: 'default',
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: activeTempUser.id,
        action: 'USER_REQUIRED_PASSWORD_CHANGE_INITIATED',
        ipAddress: '127.0.0.1',
        userAgent: 'Jest Agent',
      }),
    });
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects invalid login credentials before starting password-change flow', async () => {
    const passwordHash = await bcrypt.hash('TempPassword123!', 10);
    prisma.user.findFirst.mockResolvedValue({
      ...activeTempUser,
      passwordHash,
    });

    await expect(
      service.login({
        identifier: 'temp.user@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
  });

  it('sets required password, clears mustChangePassword, revokes sessions, and requires login again', async () => {
    const passwordChangeToken = 'change-token';
    const tokenHash = crypto
      .createHash('sha256')
      .update(passwordChangeToken)
      .digest('hex');

    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-token-1',
      userId: activeTempUser.id,
      tokenHash,
      isUsed: false,
      expiresAt: new Date(Date.now() + 60_000),
      user: activeTempUser,
    });

    const result = await service.setRequiredPassword(
      {
        passwordChangeToken,
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      },
      '127.0.0.1',
      'Jest Agent',
    );

    expect(result).toEqual({
      success: true,
      message:
        'Password set successfully. Please log in again with your new password.',
    });
    expect(prisma.passwordResetToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash },
      include: { user: true },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: activeTempUser.id },
      data: {
        passwordHash: expect.any(String),
        passwordChangedAt: expect.any(Date),
        mustChangePassword: false,
      },
    });
    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'reset-token-1' },
      data: {
        isUsed: true,
        usedAt: expect.any(Date),
      },
    });
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: { userId: activeTempUser.id, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: expect.any(Date),
      },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: activeTempUser.id, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: expect.any(Date),
      },
    });
    expect(
      mailService.sendPasswordResetSuccessNotification,
    ).toHaveBeenCalledWith(activeTempUser.email, activeTempUser.firstName);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorId: activeTempUser.id,
        action: 'USER_REQUIRED_PASSWORD_CHANGE_COMPLETE',
        ipAddress: '127.0.0.1',
        userAgent: 'Jest Agent',
      }),
    });
  });

  it('rejects mismatched required password confirmation', async () => {
    await expect(
      service.setRequiredPassword({
        passwordChangeToken: 'change-token',
        newPassword: 'NewPassword123!',
        confirmPassword: 'DifferentPassword123!',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(prisma.passwordResetToken.findUnique).not.toHaveBeenCalled();
  });

  it('rejects expired or already-used required password tokens', async () => {
    prisma.passwordResetToken.findUnique.mockResolvedValue({
      id: 'reset-token-1',
      userId: activeTempUser.id,
      isUsed: true,
      expiresAt: new Date(Date.now() + 60_000),
      user: activeTempUser,
    });

    await expect(
      service.setRequiredPassword({
        passwordChangeToken: 'change-token',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('initiates registration for a new email and sends an OTP', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'new.user@example.com',
      username: 'newuser',
      firstName: 'New',
      lastName: 'User',
    });

    const result = await service.registerInitiate({
      email: 'New.User@Example.COM',
      firstName: 'New',
      lastName: 'User',
    });

    expect(result).toEqual({
      message: 'Verification OTP has been sent to your email address',
      userId: 'user-1',
      email: 'new.user@example.com',
    });
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: {
        email: 'new.user@example.com',
        username: 'newuser',
        firstName: 'New',
        lastName: 'User',
        isActive: false,
        emailVerified: false,
      },
    });
    expect(prisma.emailVerificationToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        tenantId: 'default',
        email: 'new.user@example.com',
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    });
    expect(mailService.sendRegistrationOtp).toHaveBeenCalledWith(
      'new.user@example.com',
      expect.stringMatching(/^\d{6}$/),
    );
  });

  it('rejects registration when the email is already active', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      isActive: true,
      passwordHash: 'hash',
    });

    await expect(
      service.registerInitiate({ email: 'new.user@example.com' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('completes registration and clears mustChangePassword', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'new.user@example.com',
      firstName: 'New',
    });
    prisma.emailVerificationToken.findFirst.mockResolvedValue({
      id: 'email-token-1',
      isUsed: true,
    });
    prisma.role.findFirst.mockResolvedValue({ id: 'role-default' });
    prisma.user.update.mockResolvedValue({
      id: 'user-1',
      email: 'new.user@example.com',
      firstName: 'New',
    });

    await expect(
      service.registerComplete({
        email: 'new.user@example.com',
        code: '123456',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      }),
    ).resolves.toMatchObject({ success: true });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        passwordHash: expect.any(String),
        passwordChangedAt: expect.any(Date),
        mustChangePassword: false,
        isActive: true,
        emailVerified: true,
        roles: {
          connect: { id: 'role-default' },
        },
      }),
    });
    expect(mailService.sendWelcomeNotification).toHaveBeenCalledWith(
      'new.user@example.com',
      'New',
    );
  });

  it('issues tokens and creates a session for normal credential login', async () => {
    const passwordHash = await bcrypt.hash('Password123!', 10);
    const user = {
      ...activeTempUser,
      mustChangePassword: false,
      passwordHash,
    };
    prisma.user.findFirst.mockResolvedValue(user);
    prisma.user.update.mockResolvedValue(user);
    prisma.userSession.findMany = jest.fn().mockResolvedValue([]);
    prisma.mfaConfig.findUnique.mockResolvedValue(null);
    prisma.userSession.create.mockResolvedValue({
      id: 'session-1',
      tenantId: 'default',
    });
    prisma.user.findUnique.mockResolvedValue(authPayloadUser);

    const result = await service.login(
      { identifier: 'temp.user@example.com', password: 'Password123!' },
      '127.0.0.1',
      'Mozilla/5.0 Windows Chrome',
    );

    expect(result).toMatchObject({
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
      requiresPasswordChange: false,
      message: 'Login successful',
    });
    expect(prisma.userSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        tenantId: 'default',
        ipAddress: '127.0.0.1',
        deviceType: 'desktop',
        platform: 'Windows',
      }),
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: 'session-1',
        userId: user.id,
        tenantId: 'default',
        tokenHash: expect.any(String),
      }),
    });
  });

  it('refreshes tokens and rotates the refresh token family', async () => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sessionId: 'session-1',
    });
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'refresh-token-1',
      sessionId: 'session-1',
      userId: 'user-1',
      familyId: 'family-1',
      isUsed: false,
      isRevoked: false,
      session: {
        id: 'session-1',
        isRevoked: false,
        createdAt: new Date(Date.now() - 60_000),
        expiresAt: new Date(Date.now() + 60_000),
      },
      user: {
        id: 'user-1',
        email: 'temp.user@example.com',
        username: 'tempuser',
        isActive: true,
        passwordChangedAt: null,
        roles: [],
      },
    });
    prisma.user.findUnique.mockResolvedValue(authPayloadUser);

    const result = await service.refresh({ refreshToken: 'old-refresh' });

    expect(result).toMatchObject({
      tokens: {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      },
      requiresPasswordChange: false,
    });
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'refresh-token-1' },
      data: {
        isUsed: true,
        usedAt: expect.any(Date),
      },
    });
    expect(prisma.refreshToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: 'session-1',
        userId: 'user-1',
        familyId: 'family-1',
        replacedByTokenId: 'refresh-token-1',
      }),
    });
  });

  it('revokes a session and refresh tokens on logout', async () => {
    await expect(
      service.logout('session-1', 'user-1', '127.0.0.1', 'Jest Agent'),
    ).resolves.toEqual({
      success: true,
      message: 'Logged out successfully',
    });

    expect(prisma.userSession.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: {
        isRevoked: true,
        revokedAt: expect.any(Date),
        revokedBy: 'user-1',
      },
    });
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { sessionId: 'session-1' },
      data: {
        isRevoked: true,
        revokedAt: expect.any(Date),
      },
    });
  });

  it('initiates forgot password without leaking missing users', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.forgotPassword({ identifier: 'missing@example.com' }),
    ).resolves.toEqual({
      message:
        'If the email or username exists in our system, a password reset OTP has been sent.',
    });

    expect(prisma.passwordResetToken.create).not.toHaveBeenCalled();
    expect(mailService.sendPasswordResetOtp).not.toHaveBeenCalled();
  });

  it('verifies a password reset OTP and marks it used', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      isActive: true,
    });
    prisma.passwordResetToken.findFirst.mockResolvedValue({
      id: 'reset-token-1',
    });

    await expect(
      service.resetPasswordVerify({
        identifier: 'temp.user@example.com',
        otp: '123456',
      }),
    ).resolves.toMatchObject({ success: true });

    expect(prisma.passwordResetToken.update).toHaveBeenCalledWith({
      where: { id: 'reset-token-1' },
      data: {
        isUsed: true,
        usedAt: expect.any(Date),
      },
    });
  });

  it('changes password for an authenticated user and revokes other sessions', async () => {
    const passwordHash = await bcrypt.hash('CurrentPassword123!', 10);
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'temp.user@example.com',
      firstName: 'Temp',
      passwordHash,
    });

    await expect(
      service.changePassword('user-1', 'session-current', {
        currentPassword: 'CurrentPassword123!',
        newPassword: 'NewPassword123!',
        confirmPassword: 'NewPassword123!',
      }),
    ).resolves.toMatchObject({ success: true });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        passwordHash: expect.any(String),
        passwordChangedAt: expect.any(Date),
        mustChangePassword: false,
      },
    });
    expect(prisma.userSession.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        id: { not: 'session-current' },
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: expect.any(Date),
      },
    });
  });
});
