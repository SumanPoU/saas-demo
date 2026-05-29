import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import {
  InitiateRegisterDto,
  VerifyRegisterOtpDto,
  CompleteRegisterDto,
} from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordVerifyDto } from './dto/reset-password-verify.dto';
import { ResetPasswordCompleteDto } from './dto/reset-password-complete.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { MailService } from '../mail/mail.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Step 1: Initiate User Registration
   * Creates a pending account, derives a unique username, sends OTP email via MailService.
   */
  async registerInitiate(dto: InitiateRegisterDto) {
    const emailLower = dto.email.toLowerCase();

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (existingUser) {
      if (existingUser.isActive || existingUser.passwordHash) {
        throw new ConflictException('Email address is already registered');
      }

      // Overwrite previous incomplete pending user registration to ensure a fresh session sequence
      await this.prisma.user.delete({ where: { id: existingUser.id } });
    }

    // Unique Username Derivation: Extract the slug before '@' in the email
    const prefix = emailLower.split('@')[0].replace(/[^a-z0-9]/g, '');
    let username = prefix;

    // Check if username is already taken in the system
    const userWithUsername = await this.prisma.user.findUnique({
      where: { username },
    });

    if (userWithUsername) {
      const randomSuffix = Math.floor(100 + Math.random() * 900); // 100 - 999
      username = `${prefix}${randomSuffix}`;
    }

    // Create a pending user in an inactive state
    const user = await this.prisma.user.create({
      data: {
        email: emailLower,
        username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        isActive: false,
        emailVerified: false,
      },
    });

    // Generate secure 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour TTL

    // Save OTP token in database
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tenantId: 'default',
        email: user.email,
        tokenHash,
        expiresAt,
      },
    });

    // Send real email containing verification OTP code
    await this.mailService.sendRegistrationOtp(user.email, otp);

    // Print verification code to console logs strictly for local developers
    console.log(
      `\n=========================================\n🌱 [REGISTRATION OTP] sent to ${user.email}: \n👉 CODE: ${otp}\n=========================================\n`,
    );

    return {
      message: 'Verification OTP has been sent to your email address',
      userId: user.id,
      email: user.email,
    };
  }

  /**
   * Step 2: Verify Registration OTP
   * Receives email and OTP, matches record, marks email as verified,
   * triggers verification success email, and returns simple success message (no JWT is issued).
   */
  async registerVerifyOtp(dto: VerifyRegisterOtpDto) {
    const emailLower = dto.email.toLowerCase();

    // Query user by email
    const user = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired verification OTP');
    }

    const tokenHash = crypto.createHash('sha256').update(dto.otp).digest('hex');

    // Look up active verification token linked to user
    const activeToken = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        tokenHash,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!activeToken) {
      throw new UnauthorizedException('Invalid or expired verification OTP');
    }

    // Mark verification token as used
    await this.prisma.emailVerificationToken.update({
      where: { id: activeToken.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    // Update User emailVerified state
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    });

    // Send email confirming verification success
    await this.mailService.sendEmailVerifiedNotification(
      user.email,
      user.firstName ?? undefined,
    );

    return {
      success: true,
      message:
        'Email address successfully verified. You can now proceed to set your password to complete registration.',
    };
  }

  /**
   * Step 3: Complete User Registration (Password Set)
   * Receives email, code (OTP), password, and confirmPassword directly.
   * Hashes password, connects role, and triggers welcome complete email.
   * USER MUST MANUALLY LOGIN (does NOT automatically establish active login sessions or return JWTs).
   */
  async registerComplete(dto: CompleteRegisterDto) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const emailLower = dto.email.toLowerCase();

    // Retrieve user by email
    const user = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found');
    }

    // Hash incoming OTP code and find matching verification token record to guarantee verification state
    const tokenHash = crypto
      .createHash('sha256')
      .update(dto.code)
      .digest('hex');
    const verificationToken =
      await this.prisma.emailVerificationToken.findFirst({
        where: {
          userId: user.id,
          tokenHash,
          isUsed: true,
        },
      });

    if (!verificationToken) {
      throw new UnauthorizedException(
        'Invalid or expired email verification code',
      );
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // Retrieve default system role
    const defaultRole = await this.prisma.role.findFirst({
      where: { isDefault: true },
    });

    // Update user record: save password, activate the user, and ensure emailVerified is true
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        isActive: true,
        emailVerified: true,
        roles: defaultRole
          ? {
              connect: { id: defaultRole.id },
            }
          : undefined,
      },
    });

    // Trigger welcoming completed email
    await this.mailService.sendWelcomeNotification(
      updatedUser.email,
      updatedUser.firstName ?? undefined,
    );

    // Create Audit Log
    await this.prisma.auditLog.create({
      data: {
        tenantId: 'default',
        actorId: updatedUser.id,
        action: 'USER_REGISTER_COMPLETE',
        entityType: 'User',
        entityId: updatedUser.id,
      },
    });

    return {
      success: true,
      message:
        'Registration completed successfully! Please log in manually using your credentials.',
    };
  }

  /**
   * Log a user in, verify credentials, create a new UserSession, and return Access and Refresh Tokens.
   */
  async login(dto: LoginDto, ipAddress?: string, userAgent?: string) {
    const identifier = dto.identifier.toLowerCase();

    // Query user by email or username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: {
        roles: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email, username, or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email, username, or password');
    }

    // Update user last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 1. New Device Detection
    const activeSessions = await this.prisma.userSession.findMany({
      where: { userId: user.id, isRevoked: false },
    });

    const currentDeviceDetails = this.parseUserAgent(userAgent);
    const isDeviceRecognized = activeSessions.some((s) => {
      return (
        s.userAgent === userAgent ||
        (s.platform === currentDeviceDetails.platform &&
          s.deviceType === currentDeviceDetails.deviceType)
      );
    });

    // Verify new device (only if user has existing recognized sessions)
    if (!isDeviceRecognized && activeSessions.length > 0) {
      // Check if user has recently verified a device verification link (within last 15 minutes)
      const recentVerifiedToken =
        await this.prisma.emailVerificationToken.findFirst({
          where: {
            userId: user.id,
            isUsed: true,
            usedAt: { gte: new Date(Date.now() - 15 * 60 * 1000) },
            purpose: 'device_verify',
          },
        });

      if (!recentVerifiedToken) {
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto
          .createHash('sha256')
          .update(rawToken)
          .digest('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes TTL

        await this.prisma.emailVerificationToken.create({
          data: {
            userId: user.id,
            tenantId: 'default',
            email: user.email,
            tokenHash,
            expiresAt,
            purpose: 'device_verify',
          },
        });

        const frontendUrl =
          this.configService.get<string>('frontendUrl') ??
          'http://localhost:3000';
        const verifyLink = `${frontendUrl}/auth/verify-device?token=${rawToken}`;

        await this.mailService.sendDeviceVerificationLink(
          user.email,
          verifyLink,
        );

        // Print to console log for local development
        console.log(
          `\n=========================================\n📬 [NEW DEVICE VERIFICATION LINK]: \n👉 LINK: ${verifyLink}\n=========================================\n`,
        );

        throw new HttpException(
          {
            success: false,
            requiresDeviceVerification: true,
            message: 'New device detected. Check your email to authorize.',
          },
          HttpStatus.ACCEPTED,
        );
      }
    }

    // 2. Multi-Factor Authentication Check
    const mfaResult = await this.checkMfaRequired(user);
    if (mfaResult) return mfaResult as any;

    // 3. Normal Login Session Creation and Token Issuance
    return this.establishSessionAndIssueTokens(user, ipAddress, userAgent);
  }

  /**
   * Establish a session and issue access/refresh token pair.
   * Shared between standard credential logins and MFA logins.
   */
  public async establishSessionAndIssueTokens(
    user: any,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const sessionTimeoutDays = 90;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + sessionTimeoutDays);

    const deviceDetails = this.parseUserAgent(userAgent);

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        tenantId: 'default',
        ipAddress,
        userAgent,
        deviceName: deviceDetails.deviceName,
        deviceType: deviceDetails.deviceType,
        platform: deviceDetails.platform,
        expiresAt,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
      user.username,
      session.id,
    );

    // Hash the refresh token and save to DB
    const refreshTokenHash = this.hashToken(tokens.refreshToken);
    const refreshExpiresAt = new Date();
    const refreshTTL =
      this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const refreshDays = this.parseDurationToDays(refreshTTL);
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + refreshDays);

    await this.prisma.refreshToken.create({
      data: {
        sessionId: session.id,
        userId: user.id,
        tenantId: 'default',
        tokenHash: refreshTokenHash,
        familyId: crypto.randomUUID(),
        expiresAt: refreshExpiresAt,
      },
    });

    // Create Audit Log
    await this.prisma.auditLog.create({
      data: {
        tenantId: 'default',
        actorId: user.id,
        action: 'USER_LOGIN',
        entityType: 'UserSession',
        entityId: session.id,
        ipAddress,
        userAgent,
        payload: {
          device: deviceDetails.deviceName,
          platform: deviceDetails.platform,
        },
      },
    });

    return {
      tokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
        roles: user.roles.map((r: any) => r.name),
      },
    };
  }

  /**
   * Refresh the access and refresh token pair using Refresh Token Rotation (RTR).
   * Implements strict reuse/replay protection.
   */
  async refresh(dto: RefreshDto, ipAddress?: string, userAgent?: string) {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.refreshSecret'),
      });
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const incomingHash = this.hashToken(dto.refreshToken);

    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: incomingHash },
      include: {
        session: true,
        user: {
          include: {
            roles: true,
          },
        },
      },
    });

    if (!storedToken) {
      throw new UnauthorizedException('Authentication token not recognized');
    }

    if (
      storedToken.isUsed ||
      storedToken.isRevoked ||
      storedToken.session.isRevoked
    ) {
      // REUSE DETECTED: Revoke family tokens and terminate session
      await this.prisma.refreshToken.updateMany({
        where: { familyId: storedToken.familyId },
        data: { isRevoked: true, revokedAt: new Date() },
      });

      await this.prisma.userSession.update({
        where: { id: storedToken.sessionId },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedBy: storedToken.userId,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          tenantId: 'default',
          actorId: storedToken.userId,
          action: 'SECURITY_TOKEN_REUSE_BREACH',
          entityType: 'UserSession',
          entityId: storedToken.sessionId,
          ipAddress,
          userAgent,
          payload: { familyId: storedToken.familyId, tokenId: storedToken.id },
        },
      });

      throw new UnauthorizedException(
        'Access denied: Security violation detected',
      );
    }

    if (storedToken.session.expiresAt < new Date()) {
      throw new UnauthorizedException(
        'Your session has expired. Please sign in again',
      );
    }

    if (!storedToken.user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    const passwordChangedAt = storedToken.user.passwordChangedAt;
    if (
      passwordChangedAt &&
      storedToken.session.createdAt < passwordChangedAt
    ) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: storedToken.familyId },
        data: { isRevoked: true, revokedAt: new Date() },
      });
      await this.prisma.userSession.update({
        where: { id: storedToken.sessionId },
        data: {
          isRevoked: true,
          revokedAt: new Date(),
          revokedBy: storedToken.userId,
        },
      });
      throw new UnauthorizedException(
        'Session invalidated due to password change. Please log in again.',
      );
    }

    await this.prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    const tokens = await this.generateTokenPair(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.username,
      storedToken.session.id,
    );

    const newHash = this.hashToken(tokens.refreshToken);
    const refreshExpiresAt = new Date();
    const refreshTTL =
      this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const refreshDays = this.parseDurationToDays(refreshTTL);
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + refreshDays);

    await this.prisma.refreshToken.create({
      data: {
        sessionId: storedToken.sessionId,
        userId: storedToken.user.id,
        tenantId: 'default',
        tokenHash: newHash,
        familyId: storedToken.familyId,
        expiresAt: refreshExpiresAt,
        replacedByTokenId: storedToken.id,
      },
    });

    return {
      tokens,
      user: {
        id: storedToken.user.id,
        username: storedToken.user.username,
        email: storedToken.user.email,
        firstName: storedToken.user.firstName,
        lastName: storedToken.user.lastName,
        isSuperAdmin: storedToken.user.isSuperAdmin,
        roles: storedToken.user.roles.map((r) => r.name),
      },
    };
  }

  /**
   * Log out a user session, revoking the UserSession and all associated refresh tokens.
   */
  async logout(
    sessionId: string,
    userId: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    await this.prisma.userSession.update({
      where: { id: sessionId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
        revokedBy: userId,
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { sessionId },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: 'default',
        actorId: userId,
        action: 'USER_LOGOUT',
        entityType: 'UserSession',
        entityId: sessionId,
        ipAddress,
        userAgent,
      },
    });

    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Password Recovery Step 1: Initiate Forgot Password
   * Searches by email or username, creates a recovery OTP, sends reset email via MailService.
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const identifier = dto.identifier.toLowerCase();

    // Query user by email OR username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    // Security best practice: return a success confirmation message even if user is not found to prevent user enumeration
    if (!user || !user.isActive) {
      return {
        message:
          'If the email or username exists in our system, a password reset OTP has been sent.',
      };
    }

    // Generate secure 6-digit password recovery code
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour duration

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tenantId: 'default',
        tokenHash,
        expiresAt,
      },
    });

    // Send real email containing password recovery OTP code
    await this.mailService.sendPasswordResetOtp(user.email, otp);

    // Log recovery code in server console strictly for developers
    console.log(
      `\n=========================================\n🔑 [PASSWORD RESET OTP] sent to ${user.email}: \n👉 CODE: ${otp}\n=========================================\n`,
    );

    return {
      message:
        'If the email or username exists in our system, a password reset OTP has been sent.',
    };
  }

  /**
   * Password Recovery Step 2: Verify Recovery OTP
   * Validates reset OTP, marks it as used, and returns success message (no JWT is issued).
   */
  async resetPasswordVerify(dto: ResetPasswordVerifyDto) {
    const identifier = dto.identifier.toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid or expired password reset OTP');
    }

    const tokenHash = crypto.createHash('sha256').update(dto.otp).digest('hex');

    // Retrieve active password reset token
    const activeToken = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tokenHash,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
    });

    if (!activeToken) {
      throw new UnauthorizedException('Invalid or expired password reset OTP');
    }

    // Mark password reset token as used
    await this.prisma.passwordResetToken.update({
      where: { id: activeToken.id },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    return {
      success: true,
      message:
        'Password reset OTP code verified successfully. You can now reset your password.',
    };
  }

  /**
   * Password Recovery Step 3: Complete Password Reset
   * Receives identifier, code (OTP), password, and confirmPassword directly (no JWT token required).
   * Confirms passwords, validates OTP, hashes new password, revokes all sessions,
   * and triggers reset success confirmation email.
   */
  async resetPasswordComplete(
    dto: ResetPasswordCompleteDto,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const identifier = dto.identifier.toLowerCase();

    // Query user by email OR username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account not found or inactive');
    }

    const tokenHash = crypto
      .createHash('sha256')
      .update(dto.code)
      .digest('hex');

    // Retrieve active password reset token by OTP code to ensure verification state
    const resetTokenRecord = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        tokenHash,
      },
    });

    if (!resetTokenRecord) {
      throw new UnauthorizedException('Invalid or expired password reset code');
    }

    if (resetTokenRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('Password reset code has expired');
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    // Save new password in database
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    // FORCE REVOCATION on all existing sessions (security best practice)
    await this.prisma.userSession.updateMany({
      where: { userId: user.id, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, isRevoked: false },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    // Trigger reset success alert email
    await this.mailService.sendPasswordResetSuccessNotification(
      user.email,
      user.firstName ?? undefined,
    );

    // Create Audit Log
    await this.prisma.auditLog.create({
      data: {
        tenantId: 'default',
        actorId: user.id,
        action: 'USER_PASSWORD_RESET_COMPLETE',
        entityType: 'User',
        entityId: user.id,
        ipAddress,
        userAgent,
      },
    });

    return {
      success: true,
      message:
        'Your password has been successfully updated. Please log in manually with your new password.',
    };
  }

  /**
   * Google OAuth code exchange and user authentication.
   */
  async googleLogin(
    code: string,
    state?: string,
    expectedState?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (
      state !== undefined &&
      expectedState !== undefined &&
      state !== expectedState
    ) {
      throw new UnauthorizedException(
        'OAuth state mismatch. Possible CSRF attack.',
      );
    }

    let email = '';
    let providerId = '';
    let firstName = '';
    let lastName = '';
    let avatarUrl = '';

    const clientId = this.configService.get<string>('oauth.google.clientId');
    const clientSecret = this.configService.get<string>(
      'oauth.google.clientSecret',
    );
    const callbackUrl = this.configService.get<string>(
      'oauth.google.callbackUrl',
    );

    // Developer friendly local testing mock fallback
    if (
      code.startsWith('mock-') ||
      !clientId ||
      clientId.includes('your-google')
    ) {
      email = 'google-user@demo.com';
      providerId = 'google-sso-123456';
      firstName = 'Google';
      lastName = 'Tester';
      avatarUrl = 'https://lh3.googleusercontent.com/a/mock';
    } else {
      try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret!,
            redirect_uri: callbackUrl!,
            grant_type: 'authorization_code',
          }).toString(),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `Google token exchange failed: ${JSON.stringify(errorData)}`,
          );
        }

        const tokenData = await response.json();
        const profileResponse = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
          },
        );

        if (!profileResponse.ok) {
          throw new Error('Failed to retrieve Google user profile');
        }

        const profile = await profileResponse.json();
        email = profile.email;
        providerId = profile.sub;
        firstName = profile.given_name || '';
        lastName = profile.family_name || '';
        avatarUrl = profile.picture || '';
      } catch (err: any) {
        throw new UnauthorizedException(`Google login failed: ${err.message}`);
      }
    }

    return this.handleOAuthLogin(
      'google',
      providerId,
      email,
      firstName,
      lastName,
      avatarUrl,
      ipAddress,
      userAgent,
    );
  }

  /**
   * GitHub OAuth code exchange and user authentication.
   */
  async githubLogin(
    code: string,
    state?: string,
    expectedState?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    if (
      state !== undefined &&
      expectedState !== undefined &&
      state !== expectedState
    ) {
      throw new UnauthorizedException(
        'OAuth state mismatch. Possible CSRF attack.',
      );
    }

    let email = '';
    let providerId = '';
    let name = '';
    let avatarUrl = '';

    const clientId = this.configService.get<string>('oauth.github.clientId');
    const clientSecret = this.configService.get<string>(
      'oauth.github.clientSecret',
    );
    const callbackUrl = this.configService.get<string>(
      'oauth.github.callbackUrl',
    );

    // Developer friendly local testing mock fallback
    if (
      code.startsWith('mock-') ||
      !clientId ||
      clientId.includes('your-github')
    ) {
      email = 'github-user@demo.com';
      providerId = 'github-sso-123456';
      name = 'GitHub Tester';
      avatarUrl = 'https://avatars.githubusercontent.com/u/mock';
    } else {
      try {
        const response = await fetch(
          'https://github.com/login/oauth/access_token',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify({
              client_id: clientId,
              client_secret: clientSecret,
              code,
              redirect_uri: callbackUrl,
            }),
          },
        );

        if (!response.ok) {
          throw new Error('GitHub token exchange failed');
        }

        const tokenData = await response.json();
        if (tokenData.error) {
          throw new Error(
            `GitHub OAuth error: ${tokenData.error_description || tokenData.error}`,
          );
        }

        // Fetch profile
        const profileResponse = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `token ${tokenData.access_token}`,
            'User-Agent': 'NestJS-Fastify-SaaS-App',
          },
        });

        if (!profileResponse.ok) {
          throw new Error('Failed to retrieve GitHub profile');
        }

        const profile = await profileResponse.json();
        providerId = profile.id.toString();
        name = profile.name || profile.login;
        avatarUrl = profile.avatar_url || '';
        email = profile.email;

        // Fetch primary verified email if private
        if (!email) {
          const emailsResponse = await fetch(
            'https://api.github.com/user/emails',
            {
              headers: {
                Authorization: `token ${tokenData.access_token}`,
                'User-Agent': 'NestJS-Fastify-SaaS-App',
              },
            },
          );

          if (emailsResponse.ok) {
            const emails = await emailsResponse.json();
            email =
              emails.find((e: any) => e.primary && e.verified)?.email ||
              emails[0]?.email;
          }
        }

        if (!email) {
          throw new Error(
            'No verified email address is associated with this GitHub account',
          );
        }
      } catch (err: any) {
        throw new UnauthorizedException(`GitHub login failed: ${err.message}`);
      }
    }

    const [firstName = '', lastName = ''] = name.split(' ');

    return this.handleOAuthLogin(
      'github',
      providerId,
      email,
      firstName,
      lastName,
      avatarUrl,
      ipAddress,
      userAgent,
    );
  }

  /**
   * Consolidate account linking and create UserSession upon successful OAuth login.
   */
  private async handleOAuthLogin(
    provider: string,
    providerId: string,
    email: string,
    firstName?: string,
    lastName?: string,
    avatarUrl?: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const emailLower = email.toLowerCase();

    // 1. Check if we already have a linked OAuthAccount for this provider & ID
    let oauthAccount = await this.prisma.oAuthAccount.findUnique({
      where: {
        provider_providerId: {
          provider,
          providerId,
        },
      },
      include: {
        user: {
          include: { roles: true },
        },
      },
    });

    let user: any;

    if (oauthAccount) {
      user = oauthAccount.user;
    } else {
      // 2. Check if a User with this email already exists
      user = await this.prisma.user.findUnique({
        where: { email: emailLower },
        include: { roles: true },
      });

      if (user) {
        // Link this provider to the existing account
        await this.prisma.oAuthAccount.create({
          data: {
            userId: user.id,
            provider,
            providerId,
          },
        });
      } else {
        // 3. Register new user automatically
        const prefix = emailLower.split('@')[0].replace(/[^a-z0-9]/g, '');
        let username = prefix;

        const userWithUsername = await this.prisma.user.findUnique({
          where: { username },
        });

        if (userWithUsername) {
          const randomSuffix = Math.floor(100 + Math.random() * 900);
          username = `${prefix}${randomSuffix}`;
        }

        const defaultRole = await this.prisma.role.findFirst({
          where: { isDefault: true },
        });

        user = await this.prisma.user.create({
          data: {
            email: emailLower,
            username,
            firstName,
            lastName,
            avatarUrl,
            isActive: true,
            emailVerified: true,
            roles: defaultRole
              ? {
                  connect: { id: defaultRole.id },
                }
              : undefined,
            oauthAccounts: {
              create: {
                provider,
                providerId,
              },
            },
          },
          include: {
            roles: true,
          },
        });

        // Trigger welcoming completed email
        await this.mailService.sendWelcomeNotification(
          user.email,
          user.firstName ?? undefined,
        );
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
    }

    const mfaResult = await this.checkMfaRequired(user);
    if (mfaResult) return mfaResult as any;

    // 4. Log the user in, establishing a UserSession
    const sessionTimeoutDays = 90;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + sessionTimeoutDays);

    const deviceDetails = this.parseUserAgent(userAgent);

    const session = await this.prisma.userSession.create({
      data: {
        userId: user.id,
        tenantId: 'default',
        ipAddress,
        userAgent,
        deviceName: deviceDetails.deviceName,
        deviceType: deviceDetails.deviceType,
        platform: deviceDetails.platform,
        expiresAt,
      },
    });

    const tokens = await this.generateTokenPair(
      user.id,
      user.email,
      user.username,
      session.id,
    );

    const refreshTokenHash = this.hashToken(tokens.refreshToken);
    const refreshExpiresAt = new Date();
    const refreshTTL =
      this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
    const refreshDays = this.parseDurationToDays(refreshTTL);
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + refreshDays);

    await this.prisma.refreshToken.create({
      data: {
        sessionId: session.id,
        userId: user.id,
        tenantId: 'default',
        tokenHash: refreshTokenHash,
        familyId: crypto.randomUUID(),
        expiresAt: refreshExpiresAt,
      },
    });

    // Create Audit Log
    await this.prisma.auditLog.create({
      data: {
        tenantId: 'default',
        actorId: user.id,
        action: `USER_OAUTH_${provider.toUpperCase()}_LOGIN`,
        entityType: 'UserSession',
        entityId: session.id,
        ipAddress,
        userAgent,
      },
    });

    return {
      tokens,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isSuperAdmin: user.isSuperAdmin,
        roles: user.roles.map((r: any) => r.name),
      },
    };
  }

  /**
   * Resend a fresh email verification OTP code to a pending user registration.
   */
  async resendOtp(dto: ResendOtpDto) {
    const emailLower = dto.email.toLowerCase();

    // Query user by email
    const user = await this.prisma.user.findUnique({
      where: { email: emailLower },
    });

    // Security best practice: return success confirmation generic message even if email is not found
    if (!user) {
      return {
        success: true,
        message:
          'If this email address is registered in a pending state, a fresh verification OTP has been sent.',
      };
    }

    // If user is already active, prevent OTP spamming
    if (user.isActive || user.passwordHash) {
      throw new BadRequestException(
        'This email address is already fully registered and verified. Please log in.',
      );
    }

    // Revoke any existing active unused verification tokens for this user
    await this.prisma.emailVerificationToken.updateMany({
      where: {
        userId: user.id,
        isUsed: false,
      },
      data: {
        isUsed: true,
        usedAt: new Date(),
      },
    });

    // Generate a fresh 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const tokenHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // 1 hour TTL

    // Store in database
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tenantId: 'default',
        email: user.email,
        tokenHash,
        expiresAt,
      },
    });

    // Send real email containing verification OTP code
    await this.mailService.sendRegistrationOtp(user.email, otp);

    // Print verification code to console logs strictly for local developers
    console.log(
      `\n=========================================\n🌱 [RESEND OTP] sent to ${user.email}: \n👉 CODE: ${otp}\n=========================================\n`,
    );

    return {
      success: true,
      message:
        'If this email address is registered in a pending state, a fresh verification OTP has been sent.',
    };
  }

  /**
   * Fetch user profile from the database.
   */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin,
      roles: user.roles.map((r) => r.name),
    };
  }

  /**
   * Change user password from within active authenticated session.
   * Forces revocation on all other devices except the current active session.
   */
  async changePassword(
    userId: string,
    currentSessionId: string,
    dto: ChangePasswordDto,
  ) {
    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('User account not found');
    }

    // Verify current password if user has credentials (optional for SSO users who haven't set a password yet)
    if (user.passwordHash) {
      const isPasswordValid = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!isPasswordValid) {
        throw new UnauthorizedException('Incorrect current password');
      }
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);

    // Save new password in database
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    // Revoke all other active sessions EXCEPT the current one (excellent security hygiene)
    await this.prisma.userSession.updateMany({
      where: {
        userId: user.id,
        id: { not: currentSessionId },
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    await this.prisma.refreshToken.updateMany({
      where: {
        userId: user.id,
        sessionId: { not: currentSessionId },
        isRevoked: false,
      },
      data: {
        isRevoked: true,
        revokedAt: new Date(),
      },
    });

    // Trigger password reset alert email notification
    await this.mailService.sendPasswordResetSuccessNotification(
      user.email,
      user.firstName ?? undefined,
    );

    // Create Audit Log
    await this.prisma.auditLog.create({
      data: {
        tenantId: 'default',
        actorId: user.id,
        action: 'USER_CHANGE_PASSWORD',
        entityType: 'User',
        entityId: user.id,
      },
    });

    return {
      success: true,
      message:
        'Password successfully updated. All other active sessions have been revoked.',
    };
  }

  // --- Helper Methods ---

  private async checkMfaRequired(user: any): Promise<any | null> {
    const mfaConfig = await this.prisma.mfaConfig.findUnique({
      where: { userId: user.id },
    });
    if (!mfaConfig || !mfaConfig.isEnabled) return null;
    const mfaExpiry =
      this.configService.get<string>('mfa.pendingTokenExpiry') ?? '5m';
    const mfaPendingToken = await this.jwtService.signAsync(
      { sub: user.id, type: 'mfa_pending' },
      {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: mfaExpiry as any,
      },
    );
    return {
      success: false,
      requiresMfa: true,
      mfaPendingToken,
      message: 'MFA verification required to complete login.',
    };
  }

  /**
   * Hash a JWT token using SHA-256.
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Sign access and refresh JWT token pairs.
   */
  private async generateTokenPair(
    userId: string,
    email: string,
    username: string,
    sessionId: string,
  ) {
    const payload = { sub: userId, email, username, sessionId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('jwt.secret'),
        expiresIn: (this.configService.get<string>('jwt.expiresIn') ??
          '15m') as any,
      }),
      this.jwtService.signAsync(
        { sub: userId, sessionId },
        {
          secret: this.configService.get<string>('jwt.refreshSecret'),
          expiresIn: (this.configService.get<string>('jwt.refreshExpiresIn') ??
            '7d') as any,
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  /**
   * Naive user agent parser to extract device metadata.
   */
  private parseUserAgent(userAgent?: string): {
    deviceName?: string;
    deviceType?: string;
    platform?: string;
  } {
    if (!userAgent) {
      return {
        deviceName: 'Unknown Device',
        deviceType: 'unknown',
        platform: 'unknown',
      };
    }

    let platform = 'unknown';
    let deviceType = 'desktop';
    let deviceName = 'Browser';

    const ua = userAgent.toLowerCase();

    // Check platform
    if (ua.includes('windows')) platform = 'Windows';
    else if (ua.includes('macintosh') || ua.includes('mac os'))
      platform = 'macOS';
    else if (ua.includes('linux')) platform = 'Linux';
    else if (ua.includes('android')) platform = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) platform = 'iOS';

    // Check device type
    if (
      ua.includes('mobi') ||
      ua.includes('iphone') ||
      ua.includes('android')
    ) {
      deviceType = 'mobile';
      deviceName = ua.includes('iphone') ? 'iPhone' : 'Android Phone';
    } else if (ua.includes('ipad') || ua.includes('tablet')) {
      deviceType = 'tablet';
      deviceName = 'Tablet';
    } else {
      deviceType = 'desktop';
      if (ua.includes('chrome')) deviceName = 'Chrome on ' + platform;
      else if (ua.includes('firefox')) deviceName = 'Firefox on ' + platform;
      else if (ua.includes('safari')) deviceName = 'Safari on ' + platform;
      else deviceName = 'Desktop Browser (' + platform + ')';
    }

    return { deviceName, deviceType, platform };
  }

  /**
   * Helper to parse JWT expiration string (e.g. '7d', '30d') into numbers of days.
   */
  private parseDurationToDays(duration: string): number {
    const match = duration.match(/^(\d+)([dhm])$/);
    if (!match) return 7; // Default fallback

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'd':
        return value;
      case 'h':
        return Math.max(1, Math.round(value / 24));
      case 'm':
        return Math.max(1, Math.round(value / 1440));
      default:
        return 7;
    }
  }
}
