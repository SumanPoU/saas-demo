import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { RuntimeConfigService } from '../config/runtime-config.service';

@Injectable()
export class MfaService {
  private readonly logger = new Logger(MfaService.name);
  private readonly usedTotpCodes = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly runtimeConfig: RuntimeConfigService,
    @Inject(forwardRef(() => AuthService))
    private readonly authService: AuthService,
  ) {
    // Configure otplib to allow 1 step drift window (± 30s)
    authenticator.options = { window: 1 };
  }

  /**
   * Encrypt plaintext using AES-256-CBC and return iv:encryptedData (hex:hex format).
   */
  private encrypt(text: string): string {
    const rawKey = this.config.get<string>('mfa.encryptionKey');
    if (!rawKey || rawKey.length !== 64) {
      throw new Error(
        'MFA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).',
      );
    }
    const key = Buffer.from(rawKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * Decrypt iv:encryptedData (hex:hex format) using AES-256-CBC.
   */
  private decrypt(text: string): string {
    const rawKey = this.config.get<string>('mfa.encryptionKey');
    if (!rawKey || rawKey.length !== 64) {
      throw new Error(
        'MFA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).',
      );
    }
    const key = Buffer.from(rawKey, 'hex');
    const parts = text.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted text format.');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = Buffer.from(parts[1], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Step 1: Initiate MFA Setup
   * Generates a TOTP secret, encrypts it, upserts the MfaConfig, and creates a QR code.
   */
  async setup(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User account not found');
    }

    // Generate fresh TOTP secret
    const secret = authenticator.generateSecret();
    const encryptedSecret = this.encrypt(secret);

    // Save/update temporary MFA config (disabled until verified)
    await this.prisma.mfaConfig.upsert({
      where: { userId },
      update: {
        method: 'totp',
        isEnabled: false,
        totpSecret: encryptedSecret,
        totpVerifiedAt: null,
      },
      create: {
        userId,
        method: 'totp',
        isEnabled: false,
        totpSecret: encryptedSecret,
      },
    });

    const appName = await this.runtimeConfig.getString('APP_NAME');
    const keyuri = authenticator.keyuri(user.email, appName, secret);
    const qrCode = await QRCode.toDataURL(keyuri);

    return {
      success: true,
      message: 'MFA setup initiated. Scan the QR code to proceed.',
      data: {
        qrCode,
        secret,
      },
    };
  }

  /**
   * Step 2: Verify MFA Setup
   * Validates code, enables MFA, and generates 8 secure backup codes.
   */
  async verifySetup(userId: string, code: string) {
    const mfaConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId },
    });

    if (!mfaConfig || !mfaConfig.totpSecret) {
      throw new NotFoundException('MFA configuration has not been initiated.');
    }

    if (this.isTotpCodeUsed(userId, code)) {
      throw new UnauthorizedException(
        'TOTP code has already been used. Wait for the next code.',
      );
    }

    const decryptedSecret = this.decrypt(mfaConfig.totpSecret);
    const isValid = authenticator.verify({
      token: code,
      secret: decryptedSecret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired TOTP code');
    }
    this.markTotpCodeUsed(userId, code);

    // Generate 8 backup codes (8-character uppercase hex strings)
    const { plainCodes: backupCodes, hashedData: hashedCodesData } =
      await this.buildBackupCodes(mfaConfig.id);

    // Set enabled and delete/replace backup codes
    await this.prisma.$transaction([
      this.prisma.mfaConfig.update({
        where: { id: mfaConfig.id },
        data: {
          isEnabled: true,
          totpVerifiedAt: new Date(),
        },
      }),
      this.prisma.mfaBackupCode.deleteMany({
        where: { mfaConfigId: mfaConfig.id },
      }),
      this.prisma.mfaBackupCode.createMany({
        data: hashedCodesData,
      }),
    ]);

    // Log in AuditLog
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'mfa_enabled',
        entityType: 'user',
        entityId: userId,
      },
    });

    return {
      success: true,
      message: 'Multi-Factor Authentication has been successfully enabled.',
      data: {
        backupCodes,
      },
    };
  }

  /**
   * Step 3: Regenerate Backup Codes
   * Requires valid TOTP confirmation code, replaces all backup codes, and returns new ones once.
   */
  async regenerateBackupCodes(userId: string, code: string) {
    const mfaConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId },
    });

    if (!mfaConfig || !mfaConfig.totpSecret || !mfaConfig.isEnabled) {
      throw new BadRequestException(
        'MFA must be active to regenerate backup codes.',
      );
    }

    if (this.isTotpCodeUsed(userId, code)) {
      throw new UnauthorizedException(
        'TOTP code has already been used. Wait for the next code.',
      );
    }

    const decryptedSecret = this.decrypt(mfaConfig.totpSecret);
    const isValid = authenticator.verify({
      token: code,
      secret: decryptedSecret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired TOTP code');
    }
    this.markTotpCodeUsed(userId, code);

    const { plainCodes: backupCodes, hashedData: hashedCodesData } =
      await this.buildBackupCodes(mfaConfig.id);

    await this.prisma.$transaction([
      this.prisma.mfaBackupCode.deleteMany({
        where: { mfaConfigId: mfaConfig.id },
      }),
      this.prisma.mfaBackupCode.createMany({
        data: hashedCodesData,
      }),
    ]);

    // Log Audit Log
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'mfa_backup_codes_regenerated',
        entityType: 'user',
        entityId: userId,
      },
    });

    return {
      success: true,
      message:
        'Backup codes successfully regenerated. Save these in a secure location.',
      data: {
        backupCodes,
      },
    };
  }

  /**
   * Step 4: Verify MFA Login
   * Checks pending token, supports either 6-digit TOTP codes or 8-character backup codes,
   * marks backup code as used, warns if out of backup codes, and returns signed application tokens.
   */
  async verifyLogin(
    mfaPendingToken: string,
    code: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    let payload: { sub: string; type?: string };
    try {
      payload = await this.jwtService.verifyAsync(mfaPendingToken, {
        secret: this.config.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired MFA pending token.');
    }

    if (payload.type !== 'mfa_pending') {
      throw new UnauthorizedException('Invalid token scope mapping.');
    }

    const userId = payload.sub;
    const mfaConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId },
    });

    if (!mfaConfig || !mfaConfig.isEnabled) {
      throw new UnauthorizedException('MFA is not active for this account.');
    }

    const cleanedCode = code.trim().toUpperCase();
    const isTotp = /^\d{6}$/.test(cleanedCode);

    if (isTotp) {
      // TOTP path
      if (this.isTotpCodeUsed(userId, cleanedCode)) {
        throw new UnauthorizedException(
          'TOTP code has already been used. Wait for the next code.',
        );
      }

      const decryptedSecret = this.decrypt(mfaConfig.totpSecret!);
      const isValid = authenticator.verify({
        token: cleanedCode,
        secret: decryptedSecret,
      });

      if (!isValid) {
        throw new UnauthorizedException('Invalid TOTP code');
      }
      this.markTotpCodeUsed(userId, cleanedCode);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: { roles: true, tenantMemberships: true },
      });

      if (!user) {
        throw new UnauthorizedException('User account not found');
      }

      const defaultMembership =
        user.tenantMemberships?.find((m) => m.isOwner) ||
        user.tenantMemberships?.[0];
      if (!defaultMembership) {
        throw new UnauthorizedException(
          'User does not belong to any workspace. Contact support.',
        );
      }

      const loginResult = await this.authService.establishSessionAndIssueTokens(
        user,
        defaultMembership.tenantId,
        ipAddress,
        userAgent,
      );

      await this.prisma.auditLog.create({
        data: {
          actorId: userId,
          action: 'mfa_verified',
          entityType: 'user',
          entityId: userId,
        },
      });

      return {
        success: true,
        message: 'MFA successfully authenticated.',
        data: {
          accessToken: loginResult.tokens.accessToken,
          refreshToken: loginResult.tokens.refreshToken,
          warning: undefined as string | undefined,
        },
      };
    }

    // Backup code path (8 chars / 10 alphanumeric)
    if (cleanedCode.length !== 10) {
      throw new UnauthorizedException('Invalid verification code length.');
    }

    const activeBackupCodes = await this.prisma.mfaBackupCode.findMany({
      where: {
        mfaConfigId: mfaConfig.id,
        isUsed: false,
      },
    });

    let matchedCodeId: string | null = null;
    for (const bc of activeBackupCodes) {
      const isMatch = await bcrypt.compare(cleanedCode, bc.codeHash);
      if (isMatch) {
        matchedCodeId = bc.id;
        break;
      }
    }

    if (!matchedCodeId) {
      throw new UnauthorizedException('Invalid backup code');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true, tenantMemberships: true },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found');
    }

    const defaultMembership =
      user.tenantMemberships?.find((m) => m.isOwner) ||
      user.tenantMemberships?.[0];
    if (!defaultMembership) {
      throw new UnauthorizedException(
        'User does not belong to any workspace. Contact support.',
      );
    }

    // Mark backup code used + issue session atomically so a failure
    // never leaves a consumed code without a session (or vice versa).
    const { loginResult, warning } = await this.prisma.$transaction(
      async (tx) => {
        await tx.mfaBackupCode.update({
          where: { id: matchedCodeId },
          data: {
            isUsed: true,
            usedAt: new Date(),
          },
        });

        const remainingUnused = await tx.mfaBackupCode.count({
          where: {
            mfaConfigId: mfaConfig.id,
            isUsed: false,
          },
        });

        const sessionResult =
          await this.authService.establishSessionAndIssueTokens(
            user,
            defaultMembership.tenantId,
            ipAddress,
            userAgent,
            tx,
          );

        await tx.auditLog.create({
          data: {
            actorId: userId,
            action: 'mfa_verified',
            entityType: 'user',
            entityId: userId,
          },
        });

        return {
          loginResult: sessionResult,
          warning:
            remainingUnused === 0
              ? 'You have used your last backup code. Please regenerate backup codes immediately.'
              : undefined,
        };
      },
    );

    return {
      success: true,
      message: 'MFA successfully authenticated.',
      data: {
        accessToken: loginResult.tokens.accessToken,
        refreshToken: loginResult.tokens.refreshToken,
        warning,
      },
    };
  }

  /**
   * Step 5: Verify Device Token
   * Validates device registration link code, marking it authorized.
   */
  async verifyDevice(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const deviceToken = await this.prisma.emailVerificationToken.findFirst({
      where: {
        tokenHash,
        isUsed: false,
        expiresAt: { gt: new Date() },
        purpose: 'device_verify',
      },
    });

    if (!deviceToken) {
      throw new UnauthorizedException(
        'Invalid or expired device verification link.',
      );
    }

    await this.prisma.emailVerificationToken.update({
      where: { id: deviceToken.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    // Write to audit log
    await this.prisma.auditLog.create({
      data: {
        actorId: deviceToken.userId,
        action: 'new_device_authorized',
        entityType: 'user',
        entityId: deviceToken.userId,
      },
    });

    return {
      success: true,
      message: 'Device authorized successfully. You may now return to log in.',
    };
  }

  /**
   * Step 6: Disable MFA
   * Requires valid TOTP code to confirm disabling MFA.
   */
  async disable(userId: string, code: string) {
    const mfaConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId },
    });

    if (!mfaConfig || !mfaConfig.totpSecret || !mfaConfig.isEnabled) {
      throw new BadRequestException('MFA is not enabled on this account.');
    }

    if (this.isTotpCodeUsed(userId, code)) {
      throw new UnauthorizedException(
        'TOTP code has already been used. Wait for the next code.',
      );
    }

    const decryptedSecret = this.decrypt(mfaConfig.totpSecret);
    const isValid = authenticator.verify({
      token: code,
      secret: decryptedSecret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP confirmation code');
    }
    this.markTotpCodeUsed(userId, code);

    await this.prisma.$transaction([
      this.prisma.mfaConfig.update({
        where: { id: mfaConfig.id },
        data: {
          isEnabled: false,
          totpSecret: null,
          totpVerifiedAt: null,
        },
      }),
      this.prisma.mfaBackupCode.deleteMany({
        where: { mfaConfigId: mfaConfig.id },
      }),
    ]);

    // Audit Log
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'mfa_disabled',
        entityType: 'user',
        entityId: userId,
      },
    });

    return {
      success: true,
      message: 'Multi-Factor Authentication has been successfully disabled.',
    };
  }

  /**
   * Step 7: Recover MFA (Initiate via email link)
   * Sends password reset OTP token and link to disable MFA if recovery email is request.
   */
  async recover(email: string) {
    const emailLower = email.toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { email: emailLower },
    });

    // Prevent enumeration: generic response
    if (!user || !user.isActive) {
      return {
        success: true,
        message: 'If that email exists, a recovery link was sent.',
      };
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto
      .createHash('sha256')
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour TTL

    await this.prisma.mfaRecoveryToken.create({
      data: {
        userId: user.id,

        tokenHash,
        expiresAt,
      },
    });

    // Dispatch recovery notification via MailService
    const frontendUrl = await this.runtimeConfig.getString('FRONTEND_URL');
    const recoveryLink = `${frontendUrl}/auth/recover-mfa?token=${rawToken}`;

    await this.mailService.sendMfaRecoveryEmail(user.email, recoveryLink);

    this.logger.debug(
      `MFA recovery link generated and emailed for userId=${user.id}`,
    );

    return {
      success: true,
      message: 'If that email exists, a recovery link was sent.',
    };
  }

  /**
   * Step 8: Verify MFA Recovery Link
   * Validates recovery link token, disables MFA, and terminates backup codes.
   */
  async verifyRecovery(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const recoveryToken = await this.prisma.mfaRecoveryToken.findFirst({
      where: {
        tokenHash,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            mfaConfig: true,
          },
        },
      },
    });

    if (!recoveryToken) {
      throw new UnauthorizedException('Invalid or expired recovery token');
    }

    const userId = recoveryToken.userId;
    const mfaConfig = recoveryToken.user.mfaConfig;

    await this.prisma.$transaction([
      this.prisma.mfaRecoveryToken.update({
        where: { id: recoveryToken.id },
        data: {
          isUsed: true,
          usedAt: new Date(),
        },
      }),
      ...(mfaConfig
        ? [
            this.prisma.mfaConfig.update({
              where: { id: mfaConfig.id },
              data: {
                isEnabled: false,
                totpSecret: null,
                totpVerifiedAt: null,
              },
            }),
            this.prisma.mfaBackupCode.deleteMany({
              where: { mfaConfigId: mfaConfig.id },
            }),
          ]
        : []),
    ]);

    // Write to audit log
    await this.prisma.auditLog.create({
      data: {
        actorId: userId,
        action: 'mfa_recovery_used',
        entityType: 'user',
        entityId: userId,
      },
    });

    return {
      success: true,
      message: 'MFA disabled. Please re-enable on next login.',
    };
  }

  /**
   * Helper to check if a TOTP code was recently used.
   * Prevents replay attacks within the 90-second drift window.
   */
  private isTotpCodeUsed(userId: string, code: string): boolean {
    const key = `${userId}:${code}`;
    const usedAt = this.usedTotpCodes.get(key);
    if (!usedAt) return false;
    if (Date.now() - usedAt > 90_000) {
      this.usedTotpCodes.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Helper to mark a TOTP code as used.
   * Stores the timestamp in an in-memory cache to prevent immediate reuse.
   */
  private markTotpCodeUsed(userId: string, code: string): void {
    this.usedTotpCodes.set(`${userId}:${code}`, Date.now());
  }

  /**
   * Helper to generate cryptographically secure backup codes.
   * Generates 8 codes, each 10 uppercase hex characters (~40 bits entropy).
   */
  private async buildBackupCodes(mfaConfigId: string): Promise<{
    plainCodes: string[];
    hashedData: { codeHash: string; mfaConfigId: string }[];
  }> {
    const plainCodes: string[] = [];
    const hashedData: { codeHash: string; mfaConfigId: string }[] = [];
    for (let i = 0; i < 8; i++) {
      const rawCode = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 chars, ~40 bits
      plainCodes.push(rawCode);
      hashedData.push({
        codeHash: await bcrypt.hash(
          rawCode,
          await this.runtimeConfig.getBcryptSaltRounds(),
        ),
        mfaConfigId,
      });
    }
    return { plainCodes, hashedData };
  }
}
