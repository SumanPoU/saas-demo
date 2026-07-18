import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Type } from 'class-transformer';

export class TenantMembershipSummaryDto {
  @ApiProperty()
  isOwner: boolean;
}

/**
 * Safe tenant / workspace payload for API responses.
 * Restoration tokens and other secrets are never serialized.
 */
export class TenantResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  slug: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  planId?: string | null;

  @ApiProperty()
  isActive: boolean;

  @ApiPropertyOptional()
  trialEndsAt?: Date | null;

  @ApiPropertyOptional()
  settings?: unknown;

  @ApiPropertyOptional()
  deletedAt?: Date | null;

  @ApiPropertyOptional()
  deletionRequestedAt?: Date | null;

  @ApiProperty()
  migrationVersion: number;

  @ApiProperty()
  schemaVersion: number;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: [TenantMembershipSummaryDto] })
  @Type(() => TenantMembershipSummaryDto)
  memberships?: TenantMembershipSummaryDto[];

  /** Internal Postgres schema name — not exposed to clients. */
  @Exclude()
  schemaName?: string;

  /** Hashed restoration token — never returned on the wire. */
  @Exclude()
  restorationToken?: string | null;
}
