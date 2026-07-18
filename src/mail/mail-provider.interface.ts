/**
 * Abstraction over outbound email transport (SMTP, SES, console mock, etc.).
 */
export interface MailProvider {
  sendEmail(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void>;
}

export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
