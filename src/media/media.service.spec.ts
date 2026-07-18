import { NotFoundException } from '@nestjs/common';
import { MediaService } from './media.service';

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
  let configService: { get: jest.Mock };
  let minioPresign: jest.Mock;

  beforeEach(() => {
    prisma = {
      mediaFile: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    configService = {
      get: jest.fn((key: string) => {
        const values: Record<string, string | number> = {
          MINIO_ENDPOINT: 'localhost',
          MINIO_PORT: 9000,
          MINIO_ACCESS_KEY: 'minioadmin',
          MINIO_SECRET_KEY: 'minioadmin',
          MINIO_USE_SSL: 'false',
          MINIO_BUCKET_NAME: 'test-bucket',
        };
        return values[key];
      }),
    };

    service = new MediaService(prisma as never, configService as never);
    minioPresign = jest.fn().mockResolvedValue('https://minio/presigned');
    (
      service as unknown as {
        minioClient: { presignedGetObject: jest.Mock };
      }
    ).minioClient = {
      presignedGetObject: minioPresign,
    };
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
  });

  it('rejects download when the file belongs to another tenant', async () => {
    prisma.mediaFile.findFirst.mockResolvedValue(null);

    await expect(
      service.getDownloadUrl('file-tenant-b', 'tenant-a', 3600),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(prisma.mediaFile.findFirst).toHaveBeenCalledWith({
      where: { id: 'file-tenant-b', tenantId: 'tenant-a' },
    });
    expect(minioPresign).not.toHaveBeenCalled();
  });
});
