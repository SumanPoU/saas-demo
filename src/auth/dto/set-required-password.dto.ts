import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SetRequiredPasswordDto {
  @ApiProperty({
    description: 'Short-lived token returned after temporary-password login',
    example: '9f0e1d2c3b4a...',
  })
  @IsString()
  @IsNotEmpty()
  passwordChangeToken: string;

  @ApiProperty({
    description: 'New password (minimum 8 characters)',
    example: 'NewSuperSecurePassword123!',
  })
  @IsString()
  @MinLength(8, { message: 'New password must be at least 8 characters long' })
  @IsNotEmpty()
  newPassword: string;

  @ApiProperty({
    description: 'Confirmation of the new password',
    example: 'NewSuperSecurePassword123!',
  })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
