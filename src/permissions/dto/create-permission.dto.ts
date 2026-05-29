import { IsString, IsOptional, MinLength } from 'class-validator';

export class CreatePermissionDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
