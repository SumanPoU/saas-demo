import { IsString, IsOptional, IsBoolean, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateRoleDto {
  @ApiPropertyOptional({
    example: 'Manager',
    description: 'Name of the role',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({
    example: 'Responsible for managing team tasks',
    description: 'Description of the role',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Indicates if the role is a default role',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
