import { Module } from '@nestjs/common';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import { MinioStorageProvider } from './minio-storage.provider';

@Module({
  controllers: [MediaController],
  providers: [
    MinioStorageProvider,
    {
      provide: STORAGE_PROVIDER,
      useExisting: MinioStorageProvider,
    },
    MediaService,
  ],
  exports: [MediaService, STORAGE_PROVIDER],
})
export class MediaModule {}
