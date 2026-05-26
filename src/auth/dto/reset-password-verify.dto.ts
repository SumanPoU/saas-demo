import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordVerifyDto {
  @ApiProperty({ example: 'johndoe@example.com', description: 'Username or email address of the account' })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code sent for password reset' })
  @IsString()
  @IsNotEmpty()
  otp: string;
}
