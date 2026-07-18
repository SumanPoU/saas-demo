import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

/**
 * Safe media file metadata for API responses.
 * Soft-delete internals stay excluded from the public shape.
 */
export class MediaFileResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  tenantId?: string | null;

  @ApiPropertyOptional()
  uploadedById?: string | null;

  @ApiProperty()
  bucketName: string;

  @ApiProperty()
  storagePath: string;

  @ApiProperty()
  originalName: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  size: number;

  @ApiProperty()
  isPublic: boolean;

  @ApiPropertyOptional()
  purpose?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @Exclude()
  deletedAt?: Date | null;
}
