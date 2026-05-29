import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePermissionDto {
  @ApiPropertyOptional({
    example: 'users:create',
    description: 'Unique name of the permission',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({
    example: 'Allows creating new user accounts',
    description: 'Description of the permission',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
