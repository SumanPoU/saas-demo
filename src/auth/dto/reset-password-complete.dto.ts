import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordCompleteDto {
  @ApiProperty({
    example: 'johndoe@example.com',
    description: 'Username or email address of the account',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code received and verified in previous step',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'NewSuperSecurePassword123!',
    description: 'New password (minimum 8 characters)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: 'NewSuperSecurePassword123!',
    description: 'Confirmation of the new password',
  })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;
}
