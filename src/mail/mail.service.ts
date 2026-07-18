import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { RuntimeConfigService } from '../config/runtime-config.service';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly runtimeConfig: RuntimeConfigService,
  ) {}

  private cachedTransporter: nodemailer.Transporter | null = null;
  private lastMailConfigHash = '';

  private async createTransporter(): Promise<nodemailer.Transporter> {
    const host = await this.runtimeConfig.getString('MAIL_HOST');
    const port = await this.runtimeConfig.getNumber('MAIL_PORT');
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.pass');

    // Safe dynamic SMTP initialization fallback
    if (!user || !pass || user === 'mock-user') {
      this.logger.warn(
        'SMTP credentials not configured. Using console logger fallback for outgoing mail.',
      );
      return {
        sendMail: async (options: any) => {
          options.text = '[redacted]';
          this.logger.log(
            `\n=========================================\n📬 [MOCK MAIL SENT]\nTo: ${options.to}\nSubject: ${options.subject}\nText: ${options.text}\n=========================================\n`,
          );
          return { messageId: 'mock-id' };
        },
      } as any;
    }

    const configHash = `${host}:${port}`;
    if (!this.cachedTransporter || this.lastMailConfigHash !== configHash) {
      this.cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for standard ports (e.g. 587/2525)
        auth: {
          user,
          pass,
        },
      });
      this.lastMailConfigHash = configHash;
    }

    return this.cachedTransporter;
  }

  /**
   * Send a general text and HTML mail.
   */
  async sendEmail(to: string, subject: string, text: string, html: string) {
    const from = await this.runtimeConfig.getString('MAIL_FROM');
    try {
      const transporter = await this.createTransporter();
      await transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      this.logger.log(`Email successfully sent to: ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
    }
  }

  /**
   * Outbox Helper 1: Send Registration OTP Code
   */
  async sendRegistrationOtp(to: string, otp: string) {
    const subject = 'Verify Your Email Address';
    const text = `Your email verification OTP code is: ${otp}. This code is valid for 1 hour.`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eef2f6; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.01);">
        <h2 style="color: #4f46e5; text-align: center; font-size: 24px; margin-bottom: 25px; font-weight: 700; letter-spacing: -0.5px;">Verify Your Email Address</h2>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Hello,</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">Thank you for initiating registration on our platform. To verify your email address, please use the secure 6-digit OTP code below:</p>
        <div style="text-align: center; margin: 35px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e1b4b; background-color: #f8fafc; padding: 15px 35px; border-radius: 10px; border: 1px dashed #818cf8; display: inline-block;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 14px; line-height: 1.5; text-align: center;">This OTP is valid for <strong>1 hour</strong>. If you did not request this, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">&copy; ${new Date().getFullYear()} SaaS Demo. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, subject, text, html);
  }

  /**
   * Outbox Helper 2: Send Email Verified Successfully Confirmation
   */
  async sendEmailVerifiedNotification(to: string, name?: string) {
    const subject = 'Email Verified Successfully!';
    const userName = name || 'User';
    const text = `Hello ${userName}, Your email address has been successfully verified. You can now proceed to set your password and complete your registration.`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eef2f6; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #10b981; text-align: center; font-size: 24px; margin-bottom: 25px; font-weight: 700; letter-spacing: -0.5px;">Email Verified!</h2>
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">Your email address has been successfully verified in our system. You are now ready for the final step of registration: setting your secure account password!</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">Please return to the application screen to complete your password setup.</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">&copy; ${new Date().getFullYear()} SaaS Demo. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, subject, text, html);
  }

  /**
   * Outbox Helper 3: Send Registration Completed / Welcome Email
   */
  async sendWelcomeNotification(to: string, name?: string) {
    const subject = 'Welcome to Our Platform!';
    const userName = name || 'User';
    const text = `Hello ${userName}, Your account setup is complete. Welcome to our platform!`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eef2f6; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; text-align: center; font-size: 24px; margin-bottom: 25px; font-weight: 700; letter-spacing: -0.5px;">Welcome Aboard!</h2>
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">Welcome! Your account is now fully active, secure, and ready to use.</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">We are excited to have you on board. If you ever have any questions or require support, simply respond directly to this email.</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">&copy; ${new Date().getFullYear()} SaaS Demo. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, subject, text, html);
  }

  /**
   * Outbox Helper 4: Send Password Reset OTP Code
   */
  async sendPasswordResetOtp(to: string, otp: string) {
    const subject = 'Reset Your Password';
    const text = `Your password reset code is: ${otp}. This code is valid for 1 hour.`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eef2f6; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #ef4444; text-align: center; font-size: 24px; margin-bottom: 25px; font-weight: 700; letter-spacing: -0.5px;">Password Reset Request</h2>
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hello,</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">We received a request to reset the password for your account. To verify your identity and complete the reset, please use the 6-digit OTP code below:</p>
        <div style="text-align: center; margin: 35px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1e1b4b; background-color: #f8fafc; padding: 15px 35px; border-radius: 10px; border: 1px dashed #f87171; display: inline-block;">${otp}</span>
        </div>
        <p style="color: #64748b; font-size: 14px; line-height: 1.5; text-align: center;">This OTP is valid for <strong>1 hour</strong>. If you did not request a password reset, please ignore this email and secure your account credentials.</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">&copy; ${new Date().getFullYear()} SaaS Demo. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, subject, text, html);
  }

  /**
   * Outbox Helper 5: Send Password Updated Success Alert
   */
  async sendPasswordResetSuccessNotification(to: string, name?: string) {
    const subject = 'Your Password Was Reset Successfully';
    const userName = name || 'User';
    const text = `Hello ${userName}, Your password was successfully updated. If you did not initiate this change, contact support immediately.`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eef2f6; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #10b981; text-align: center; font-size: 24px; margin-bottom: 25px; font-weight: 700; letter-spacing: -0.5px;">Password Reset Successful</h2>
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hello ${userName},</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">This is a confirmation email that the password for your account was reset successfully.</p>
        <p style="color: #ef4444; font-size: 16px; line-height: 1.6; font-weight: bold; margin-bottom: 25px;">If you did not make this change, please contact our support team immediately to freeze your account credentials.</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">&copy; ${new Date().getFullYear()} SaaS Demo. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, subject, text, html);
  }

  /**
   * Outbox Helper 6: Send New Device Verification Link
   */
  async sendDeviceVerificationLink(to: string, verifyLink: string) {
    const subject = 'Authorize New Device Login';
    const text = `Authorize your new device by clicking this link: ${verifyLink}`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eef2f6; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; font-size: 24px; font-weight: bold; margin-bottom: 20px;">Authorize New Device</h2>
        <p>Hello,</p>
        <p>We detected a login attempt from a new device or browser. To authorize this device to log in to your account, please click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verifyLink}" style="background-color: #4f46e5; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Authorize Device</a>
        </div>
        <p style="color: #64748b; font-size: 14px;">This link is valid for <strong>15 minutes</strong>. If you did not attempt to log in, please secure your account immediately.</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">&copy; ${new Date().getFullYear()} SaaS Demo. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, subject, text, html);
  }

  async sendTemporaryPassword(
    to: string,
    temporaryPassword: string,
    name?: string,
  ) {
    const subject = 'Your Temporary Account Password';
    const userName = name || 'User';
    const text = `Hello ${userName}, an administrator created or reset your account password. Your temporary password is: ${temporaryPassword}. You must change it after login.`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eef2f6; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; font-size: 24px; font-weight: bold; margin-bottom: 20px;">Temporary Password</h2>
        <p>Hello ${userName},</p>
        <p>An administrator created or reset your account password. Use the temporary password below to sign in:</p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="font-size: 22px; font-weight: bold; letter-spacing: 2px; color: #1e1b4b; background-color: #f8fafc; padding: 14px 24px; border-radius: 8px; border: 1px dashed #818cf8; display: inline-block;">${temporaryPassword}</span>
        </div>
        <p style="color: #ef4444; font-weight: bold;">You must change this temporary password after login.</p>
        <p style="color: #64748b; font-size: 14px;">If you did not expect this email, contact support immediately.</p>
      </div>
    `;

    await this.sendEmail(to, subject, text, html);
  }

  /**
   * Send MFA recovery email
   */
  async sendMfaRecoveryEmail(to: string, recoveryLink: string) {
    const subject = 'Disable Multi-Factor Authentication Recovery Link';
    const text = `Please use this link to recover your account and disable MFA: ${recoveryLink}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 25px; border: 1px solid #eef2f6; border-radius: 10px;">
        <h2 style="color: #ef4444;">MFA Account Recovery Request</h2>
        <p>Hello,</p>
        <p>A request was made to disable Multi-Factor Authentication (MFA) on your account. To complete this action, please click the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${recoveryLink}" style="background-color: #ef4444; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px; font-weight: bold;">Disable MFA on Account</a>
        </div>
        <p style="color: #64748b; font-size: 14px;">This link is valid for <strong>1 hour</strong>. If you did not request this recovery action, please ignore this email and secure your account credentials immediately.</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
        <p style="font-size: 11px; color: #94a3b8; text-align: center;">&copy; SaaS Demo. All rights reserved.</p>
      </div>
    `;

    return this.sendEmail(to, subject, text, html);
  }

  /**
   * Outbox Helper 7: Send workspace / tenant invitation with accept token
   */
  async sendWorkspaceInvitation(
    to: string,
    workspaceName: string,
    invitationToken: string,
  ) {
    const subject = `You're invited to join ${workspaceName}`;
    const text = `You have been invited to join ${workspaceName}. Use this invitation token to accept: ${invitationToken}`;
    const html = `
      <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px; border: 1px solid #eef2f6; border-radius: 12px; background-color: #ffffff;">
        <h2 style="color: #4f46e5; text-align: center; font-size: 24px; margin-bottom: 25px; font-weight: 700; letter-spacing: -0.5px;">Workspace Invitation</h2>
        <p style="color: #334155; font-size: 16px; line-height: 1.6;">Hello,</p>
        <p style="color: #334155; font-size: 16px; line-height: 1.6; margin-bottom: 25px;">You have been invited to join <strong>${workspaceName}</strong>. Use the invitation token below to accept and join the workspace:</p>
        <div style="text-align: center; margin: 35px 0;">
          <span style="font-size: 18px; font-weight: bold; letter-spacing: 1px; color: #1e1b4b; background-color: #f8fafc; padding: 15px 25px; border-radius: 10px; border: 1px dashed #818cf8; display: inline-block; word-break: break-all;">${invitationToken}</span>
        </div>
        <p style="color: #64748b; font-size: 14px; line-height: 1.5; text-align: center;">This invitation is valid for <strong>7 days</strong>. If you did not expect this invite, you can safely ignore this email.</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 30px 0;">
        <p style="font-size: 12px; color: #94a3b8; text-align: center;">&copy; ${new Date().getFullYear()} SaaS Demo. All rights reserved.</p>
      </div>
    `;
    await this.sendEmail(to, subject, text, html);
  }
}
