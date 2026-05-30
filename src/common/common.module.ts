import { Global, Module } from '@nestjs/common';
import { PaginationService } from './pagination';

@Global()
@Module({
  providers: [PaginationService],
  exports: [PaginationService],
})
export class CommonModule {}
