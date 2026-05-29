import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePermissionDto {
  @ApiProperty({
    example: 'users:create',
    description: 'Unique name of the permission',
  })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({
    example: 'Allows creating new user accounts',
    description: 'Description of the permission',
  })
  @IsOptional()
  @IsString()
  description?: string;
}
