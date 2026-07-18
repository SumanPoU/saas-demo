import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Type } from 'class-transformer';

export class RolePermissionSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string | null;
}

export class RoleUserSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  username: string;

  @ApiProperty()
  email: string;
}

/**
 * Safe role payload for API responses.
 * Junction rows (`rolePermissions`) are excluded in favour of flattened `permissions`.
 */
export class RoleResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  tenantId?: string | null;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty()
  isDefault: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiPropertyOptional({ type: [RolePermissionSummaryDto] })
  @Type(() => RolePermissionSummaryDto)
  permissions?: RolePermissionSummaryDto[];

  @ApiPropertyOptional({ type: [RoleUserSummaryDto] })
  @Type(() => RoleUserSummaryDto)
  users?: RoleUserSummaryDto[];

  @Exclude()
  rolePermissions?: unknown;
}
