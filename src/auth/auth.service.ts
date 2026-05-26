import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { InitiateRegisterDto, VerifyRegisterOtpDto, CompleteRegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordVerifyDto } from './dto/reset-password-verify.dto';
import { ResetPasswordCompleteDto } from './dto/reset-password-complete.dto';
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
    console.log(`\n=========================================\n🌱 [REGISTRATION OTP] sent to ${user.email}: \n👉 CODE: ${otp}\n=========================================\n`);

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
    await this.mailService.sendEmailVerifiedNotification(user.email, user.firstName ?? undefined);

    return {
      success: true,
      message: 'Email address successfully verified. You can now proceed to set your password to complete registration.',
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
    const tokenHash = crypto.createHash('sha256').update(dto.code).digest('hex');
    const verificationToken = await this.prisma.emailVerificationToken.findFirst({
      where: {
        userId: user.id,
        tokenHash,
      },
    });

    if (!verificationToken) {
      throw new UnauthorizedException('Invalid or expired email verification code');
    }

    if (verificationToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Email verification code has expired');
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
    await this.mailService.sendWelcomeNotification(updatedUser.email, updatedUser.firstName ?? undefined);

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
      message: 'Registration completed successfully! Please log in manually using your credentials.',
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
        OR: [
          { email: identifier },
          { username: identifier },
        ],
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

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email, username, or password');
    }

    // Update user last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create a new UserSession
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
    const tokens = await this.generateTokenPair(user.id, user.email, user.username, session.id);

    // Hash the refresh token and save to DB
    const refreshTokenHash = this.hashToken(tokens.refreshToken);
    const refreshExpiresAt = new Date();
    const refreshTTL = this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
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
        payload: { device: deviceDetails.deviceName, platform: deviceDetails.platform },
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
        roles: user.roles.map((r) => r.name),
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

    if (storedToken.isUsed || storedToken.isRevoked || storedToken.session.isRevoked) {
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

      throw new UnauthorizedException('Access denied: Security violation detected');
    }

    if (storedToken.session.expiresAt < new Date()) {
      throw new UnauthorizedException('Your session has expired. Please sign in again');
    }

    if (!storedToken.user.isActive) {
      throw new UnauthorizedException('This account has been deactivated');
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
    const refreshTTL = this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d';
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
  async logout(sessionId: string, userId: string, ipAddress?: string, userAgent?: string) {
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
  async forgotPassword(dto: ForgotPasswordDto, ipAddress?: string, userAgent?: string) {
    const identifier = dto.identifier.toLowerCase();

    // Query user by email OR username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
    });

    // Security best practice: return a success confirmation message even if user is not found to prevent user enumeration
    if (!user || !user.isActive) {
      return {
        message: 'If the email or username exists in our system, a password reset OTP has been sent.',
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
    console.log(`\n=========================================\n🔑 [PASSWORD RESET OTP] sent to ${user.email}: \n👉 CODE: ${otp}\n=========================================\n`);

    return {
      message: 'If the email or username exists in our system, a password reset OTP has been sent.',
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
        OR: [
          { email: identifier },
          { username: identifier },
        ],
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
      message: 'Password reset OTP code verified successfully. You can now reset your password.',
    };
  }

  /**
   * Password Recovery Step 3: Complete Password Reset
   * Receives identifier, code (OTP), password, and confirmPassword directly (no JWT token required).
   * Confirms passwords, validates OTP, hashes new password, revokes all sessions,
   * and triggers reset success confirmation email.
   */
  async resetPasswordComplete(dto: ResetPasswordCompleteDto, ipAddress?: string, userAgent?: string) {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const identifier = dto.identifier.toLowerCase();

    // Query user by email OR username
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { username: identifier },
        ],
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User account not found or inactive');
    }

    const tokenHash = crypto.createHash('sha256').update(dto.code).digest('hex');

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
      data: { passwordHash },
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
    await this.mailService.sendPasswordResetSuccessNotification(user.email, user.firstName ?? undefined);

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
      message: 'Your password has been successfully updated. Please log in manually with your new password.',
    };
  }

  // --- Helper Methods ---

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
        expiresIn: (this.configService.get<string>('jwt.expiresIn') ?? '15m') as any,
      }),
      this.jwtService.signAsync(
        { sub: userId, sessionId },
        {
          secret: this.configService.get<string>('jwt.refreshSecret'),
          expiresIn: (this.configService.get<string>('jwt.refreshExpiresIn') ?? '7d') as any,
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
      return { deviceName: 'Unknown Device', deviceType: 'unknown', platform: 'unknown' };
    }

    let platform = 'unknown';
    let deviceType = 'desktop';
    let deviceName = 'Browser';

    const ua = userAgent.toLowerCase();

    // Check platform
    if (ua.includes('windows')) platform = 'Windows';
    else if (ua.includes('macintosh') || ua.includes('mac os')) platform = 'macOS';
    else if (ua.includes('linux')) platform = 'Linux';
    else if (ua.includes('android')) platform = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) platform = 'iOS';

    // Check device type
    if (ua.includes('mobi') || ua.includes('iphone') || ua.includes('android')) {
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
