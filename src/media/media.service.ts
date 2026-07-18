import {
  Injectable,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';
import * as path from 'path';
import { STORAGE_PROVIDER } from './storage-provider.interface';
import type { StorageProvider } from './storage-provider.interface';
import { toResponseDto } from '../common/serialization';
import { MediaFileResponseDto } from './dto/media-file-response.dto';

export interface UploadFileOptions {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  tenantId?: string;
  uploadedById?: string;
  purpose?: string;
  isPublic?: boolean;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_PROVIDER) private readonly storage: StorageProvider,
  ) {}

  /**
   * Upload a file to object storage and track it in Prisma.
   */
  async uploadFile(options: UploadFileOptions) {
    const {
      buffer,
      originalName,
      mimeType,
      size,
      tenantId,
      uploadedById,
      purpose,
      isPublic,
    } = options;

    const fileId = crypto.randomUUID();
    const ext = path.extname(originalName);
    const safePurpose = (purpose || 'misc').toLowerCase();
    const bucketName = this.storage.defaultBucket;

    let storagePath = '';
    if (tenantId) {
      storagePath = `tenants/${tenantId}/${safePurpose}/${fileId}${ext}`;
    } else {
      storagePath = `platform/${safePurpose}/${fileId}${ext}`;
    }

    try {
      await this.storage.putObject(
        bucketName,
        storagePath,
        buffer,
        Number(size),
        { 'Content-Type': mimeType },
      );

      const mediaFile = await this.prisma.mediaFile.create({
        data: {
          id: fileId,
          tenantId,
          uploadedById,
          bucketName,
          storagePath,
          originalName,
          mimeType,
          size: Number(size),
          isPublic: isPublic || false,
          purpose,
        },
      });

      return toResponseDto(MediaFileResponseDto, mediaFile);
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to upload file ${originalName}: ${err.message}`,
        err.stack,
      );
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  /**
   * Get a presigned URL for downloading a private file belonging to the tenant.
   */
  async getDownloadUrl(
    fileId: string,
    tenantId: string,
    expiresInSecs = 3600,
  ): Promise<string> {
    const mediaFile = await this.prisma.mediaFile.findFirst({
      where: { id: fileId, tenantId },
    });

    if (!mediaFile || mediaFile.deletedAt) {
      throw new NotFoundException('File not found');
    }

    return this.storage.getPresignedUrl(
      mediaFile.bucketName,
      mediaFile.storagePath,
      expiresInSecs,
    );
  }

  /**
   * Delete a file (soft delete in DB, remove from object storage).
   */
  async deleteFile(mediaFileId: string) {
    const mediaFile = await this.prisma.mediaFile.findUnique({
      where: { id: mediaFileId },
    });

    if (!mediaFile) return;

    try {
      await this.storage.removeObject(
        mediaFile.bucketName,
        mediaFile.storagePath,
      );

      await this.prisma.mediaFile.update({
        where: { id: mediaFileId },
        data: { deletedAt: new Date() },
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Failed to delete file ${mediaFile.storagePath}: ${err.message}`,
      );
      throw new InternalServerErrorException('Failed to delete file');
    }
  }
}
