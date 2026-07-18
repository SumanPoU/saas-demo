import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Type } from 'class-transformer';

export class UserRoleSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string | null;
}

/**
 * Safe user payload for API responses.
 * Sensitive credential / MFA fields are excluded even if present on the source.
 */
export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  emailVerified: boolean;

  @ApiPropertyOptional()
  firstName?: string | null;

  @ApiPropertyOptional()
  lastName?: string | null;

  @ApiPropertyOptional()
  avatarUrl?: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  isSuperAdmin: boolean;

  @ApiProperty()
  mustChangePassword: boolean;

  @ApiPropertyOptional()
  lastLoginAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: [UserRoleSummaryDto] })
  @Type(() => UserRoleSummaryDto)
  roles?: UserRoleSummaryDto[];

  @Exclude()
  passwordHash?: string | null;

  @Exclude()
  passwordChangedAt?: Date | null;

  @Exclude()
  mfaConfig?: unknown;

  @Exclude()
  sessions?: unknown;

  @Exclude()
  refreshTokens?: unknown;
}
