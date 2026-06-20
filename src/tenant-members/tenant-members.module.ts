import { Module } from '@nestjs/common';
import { TenantMembersService } from './tenant-members.service';
import { TenantMembersController } from './tenant-members.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [PrismaModule, MailModule, UsersModule],
  controllers: [TenantMembersController],
  providers: [TenantMembersService],
  exports: [TenantMembersService],
})
export class TenantMembersModule {}
