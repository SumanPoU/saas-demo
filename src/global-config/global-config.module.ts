import { Module } from '@nestjs/common';
import { RuntimeConfigModule } from '../config/runtime-config.module';
import { PrismaModule } from '../prisma/prisma.module';
import { GlobalConfigController } from './global-config.controller';
import { GlobalConfigService } from './global-config.service';

@Module({
  imports: [PrismaModule, RuntimeConfigModule],
  controllers: [GlobalConfigController],
  providers: [GlobalConfigService],
})
export class GlobalConfigModule {}
