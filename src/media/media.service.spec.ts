import { NotFoundException } from '@nestjs/common';
import { MediaService } from './media.service';
import { StorageProvider } from './storage-provider.interface';
import { MinioStorageProvider } from './minio-storage.provider';

describe('MediaService', () => {
  let service: MediaService;
  let prisma: {
    mediaFile: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let storage: {
    defaultBucket: string;
    putObject: jest.Mock;
    getPresignedUrl: jest.Mock;
    removeObject: jest.Mock;
    ensureBucket: jest.Mock;
  };

  beforeEach(() => {
    prisma = {
      mediaFile: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    storage = {
      defaultBucket: 'test-bucket',
      putObject: jest.fn(),
      getPresignedUrl: jest.fn().mockResolvedValue('https://minio/presigned'),
      removeObject: jest.fn(),
      ensureBucket: jest.fn(),
    };

    service = new MediaService(
      prisma as never,
      storage as unknown as StorageProvider,
    );
  });

  it('fails fast in production when MinIO credentials are missing', () => {
    const inputProdConfig = {
      get: jest.fn((key: string) => {
        if (key === 'node_env' || key === 'NODE_ENV') return 'production';
        return undefined;
      }),
    };

    expect(() => new MinioStorageProvider(inputProdConfig as never)).toThrow(
      /Missing required MinIO environment variable\(s\) in production/,
    );
  });

  it('returns a download URL when the file belongs to the requested tenant', async () => {
    prisma.mediaFile.findFirst.mockResolvedValue({
      id: 'file-1',
      tenantId: 'tenant-a',
      deletedAt: null,
      bucketName: 'test-bucket',
      storagePath: 'tenants/tenant-a/misc/file-1.png',
    });

    const actualUrl = await service.getDownloadUrl('file-1', 'tenant-a', 3600);

    expect(actualUrl).toBe('https://minio/presigned');
    expect(prisma.mediaFile.findFirst).toHaveBeenCalledWith({
      where: { id: 'file-1', tenantId: 'tenant-a' },
    });
    expect(storage.getPresignedUrl).toHaveBeenCalledWith(
      'test-bucket',
      'tenants/tenant-a/misc/file-1.png',
      3600,
    );
  });

  it('rejects download when the file belongs to another tenant', async () => {
    prisma.mediaFile.findFirst.mockResolvedValue(null);

    await expect(
      service.getDownloadUrl('file-tenant-b', 'tenant-a', 3600),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.mediaFile.findFirst).toHaveBeenCalledWith({
      where: { id: 'file-tenant-b', tenantId: 'tenant-a' },
    });
    expect(storage.getPresignedUrl).not.toHaveBeenCalled();
  });
});
