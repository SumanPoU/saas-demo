import { Global, Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { MAIL_PROVIDER } from './mail-provider.interface';
import { NodemailerMailProvider } from './nodemailer-mail.provider';

@Global()
@Module({
  providers: [
    NodemailerMailProvider,
    {
      provide: MAIL_PROVIDER,
      useExisting: NodemailerMailProvider,
    },
    MailService,
  ],
  exports: [MailService, MAIL_PROVIDER],
})
export class MailModule {}
