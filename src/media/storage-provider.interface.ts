/**
 * Abstraction over object storage (MinIO, S3, local disk, etc.).
 */
export interface StorageProvider {
  readonly defaultBucket: string;

  ensureBucket(bucket: string): Promise<void>;

  putObject(
    bucket: string,
    objectName: string,
    buffer: Buffer,
    size: number,
    metaData?: Record<string, string>,
  ): Promise<void>;

  getPresignedUrl(
    bucket: string,
    objectName: string,
    expiresInSecs: number,
  ): Promise<string>;

  removeObject(bucket: string, objectName: string): Promise<void>;
}

export const STORAGE_PROVIDER = Symbol('STORAGE_PROVIDER');
