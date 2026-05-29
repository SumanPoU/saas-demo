import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreatePermissionGroupDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
