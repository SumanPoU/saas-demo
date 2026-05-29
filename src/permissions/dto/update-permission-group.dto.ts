import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePermissionGroupDto {
  @ApiPropertyOptional({
    example: 'User Management',
    description: 'Name of the permission group',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({
    example: 'Updated description for the permission group',
    description: 'Description of the permission group',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
