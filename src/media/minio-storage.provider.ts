import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class MinioStorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(MinioStorageProvider.name);
  private readonly client: Minio.Client;
  readonly defaultBucket: string;

  constructor(private readonly configService: ConfigService) {
    const nodeEnv =
      this.configService.get<string>('node_env') ??
      this.configService.get<string>('NODE_ENV') ??
      'development';
    const isProduction = nodeEnv === 'production';

    const endPoint = this.configService.get<string>('MINIO_ENDPOINT');
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY');
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY');
    const configuredPort = this.configService.get<string | number>(
      'MINIO_PORT',
    );
    const port = Number(configuredPort);
    const resolvedPort = Number.isFinite(port) && port > 0 ? port : 9000;
    const useSSL = this.configService.get<string>('MINIO_USE_SSL') === 'true';
    this.defaultBucket =
      this.configService.get<string>('MINIO_BUCKET_NAME') || 'my-app-uploads';

    if (isProduction) {
      const missing = [
        !endPoint && 'MINIO_ENDPOINT',
        !accessKey && 'MINIO_ACCESS_KEY',
        !secretKey && 'MINIO_SECRET_KEY',
      ].filter(Boolean);

      if (missing.length > 0) {
        throw new Error(
          `Missing required MinIO environment variable(s) in production: ${missing.join(', ')}`,
        );
      }

      this.client = new Minio.Client({
        endPoint: endPoint!,
        port: resolvedPort,
        useSSL,
        accessKey: accessKey!,
        secretKey: secretKey!,
      });
      return;
    }

    const resolvedEndPoint = endPoint || 'localhost';
    const resolvedAccessKey = accessKey || 'minioadmin';
    const resolvedSecretKey = secretKey || 'minioadmin';

    if (!endPoint || !accessKey || !secretKey) {
      this.logger.warn(
        'MinIO credentials not fully configured; using localhost/minioadmin defaults for development only.',
      );
    }

    this.client = new Minio.Client({
      endPoint: resolvedEndPoint,
      port: resolvedPort,
      useSSL,
      accessKey: resolvedAccessKey,
      secretKey: resolvedSecretKey,
    });
  }

  async onModuleInit() {
    try {
      await this.ensureBucket(this.defaultBucket);
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `MinIO initialization failed: ${error.message}`,
        error.stack,
      );
    }
  }

  async ensureBucket(bucket: string): Promise<void> {
    const exists = await this.client.bucketExists(bucket);
    if (!exists) {
      await this.client.makeBucket(bucket, 'us-east-1');
      this.logger.log(`Created MinIO bucket: ${bucket}`);
    }
  }

  async putObject(
    bucket: string,
    objectName: string,
    buffer: Buffer,
    size: number,
    metaData?: Record<string, string>,
  ): Promise<void> {
    await this.client.putObject(bucket, objectName, buffer, size, metaData);
  }

  async getPresignedUrl(
    bucket: string,
    objectName: string,
    expiresInSecs: number,
  ): Promise<string> {
    return this.client.presignedGetObject(bucket, objectName, expiresInSecs);
  }

  async removeObject(bucket: string, objectName: string): Promise<void> {
    await this.client.removeObject(bucket, objectName);
  }
}
