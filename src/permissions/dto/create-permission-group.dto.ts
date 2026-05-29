import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePermissionGroupDto {
  @ApiProperty({
    example: 'User Management',
    description: 'Name of the permission group',
  })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({
    example: 'Permissions related to user accounts, profiles, and registration',
    description: 'Description of the permission group',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
