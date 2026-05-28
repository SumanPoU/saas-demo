import { Module, forwardRef } from '@nestjs/common';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    forwardRef(() => AuthModule),
  ],
  controllers: [MfaController],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}
