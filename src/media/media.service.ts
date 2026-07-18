import {
  Injectable,
  Logger,
  OnModuleInit,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as Minio from 'minio';
import * as crypto from 'crypto';
import * as path from 'path';

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
export class MediaService implements OnModuleInit {
  private readonly logger = new Logger(MediaService.name);
  private minioClient: Minio.Client;
  private bucketName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const endPoint =
      this.configService.get<string>('MINIO_ENDPOINT') || 'localhost';
    const port = this.configService.get<number>('MINIO_PORT') || 9000;
    const accessKey =
      this.configService.get<string>('MINIO_ACCESS_KEY') || 'minioadmin';
    const secretKey =
      this.configService.get<string>('MINIO_SECRET_KEY') || 'minioadmin';
    const useSSL = this.configService.get<string>('MINIO_USE_SSL') === 'true';

    this.bucketName =
      this.configService.get<string>('MINIO_BUCKET_NAME') || 'my-app-uploads';

    this.minioClient = new Minio.Client({
      endPoint,
      port,
      useSSL,
      accessKey,
      secretKey,
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Created MinIO bucket: ${this.bucketName}`);
      }
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `MinIO initialization failed: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Upload a file to MinIO and track it in Prisma
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

    let storagePath = '';
    if (tenantId) {
      storagePath = `tenants/${tenantId}/${safePurpose}/${fileId}${ext}`;
    } else {
      storagePath = `platform/${safePurpose}/${fileId}${ext}`;
    }

    try {
      await this.minioClient.putObject(
        this.bucketName,
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
          bucketName: this.bucketName,
          storagePath,
          originalName,
          mimeType,
          size: Number(size),
          isPublic: isPublic || false,
          purpose,
        },
      });

      return mediaFile;
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

    return this.minioClient.presignedGetObject(
      mediaFile.bucketName,
      mediaFile.storagePath,
      expiresInSecs,
    );
  }

  /**
   * Delete a file (soft delete in DB, remove from MinIO)
   */
  async deleteFile(mediaFileId: string) {
    const mediaFile = await this.prisma.mediaFile.findUnique({
      where: { id: mediaFileId },
    });

    if (!mediaFile) return;

    try {
      await this.minioClient.removeObject(
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
