import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { MailProvider } from './mail-provider.interface';

@Injectable()
export class NodemailerMailProvider implements MailProvider {
  private readonly logger = new Logger(NodemailerMailProvider.name);
  private cachedTransporter: nodemailer.Transporter | null = null;
  private lastMailConfigHash = '';

  constructor(
    private readonly config: ConfigService,
    private readonly runtimeConfig: RuntimeConfigService,
  ) {}

  private async createTransporter(): Promise<nodemailer.Transporter> {
    const host = await this.runtimeConfig.getString('MAIL_HOST');
    const port = await this.runtimeConfig.getNumber('MAIL_PORT');
    const user = this.config.get<string>('mail.user');
    const pass = this.config.get<string>('mail.pass');

    if (!user || !pass || user === 'mock-user') {
      this.logger.warn(
        'SMTP credentials not configured. Using console logger fallback for outgoing mail.',
      );
      return {
        sendMail: async (options: {
          to?: string;
          subject?: string;
          text?: string;
        }) => {
          this.logger.log(
            `\n=========================================\n📬 [MOCK MAIL SENT]\nTo: ${options.to}\nSubject: ${options.subject}\nText: [redacted]\n=========================================\n`,
          );
          return { messageId: 'mock-id' };
        },
      } as nodemailer.Transporter;
    }

    const configHash = `${host}:${port}`;
    if (!this.cachedTransporter || this.lastMailConfigHash !== configHash) {
      this.cachedTransporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user,
          pass,
        },
      });
      this.lastMailConfigHash = configHash;
    }

    return this.cachedTransporter;
  }

  async sendEmail(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
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
}
