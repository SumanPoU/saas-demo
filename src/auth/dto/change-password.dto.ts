import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPassword123!', description: 'Your current active password' })
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @ApiProperty({ example: 'NewSuperSecurePassword123!', description: 'Your new password (minimum 8 characters)' })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @IsNotEmpty()
  newPassword: string;

  @ApiProperty({ example: 'NewSuperSecurePassword123!', description: 'Confirmation of the new password' })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
