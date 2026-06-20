import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InitiateRegisterDto {
  @ApiProperty({
    example: 'johndoe@example.com',
    description: 'Valid email address of the user',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiPropertyOptional({
    example: 'John',
    description: 'First name of the user',
  })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'Last name of the user' })
  @IsString()
  @IsOptional()
  lastName?: string;
}

export class VerifyRegisterOtpDto {
  @ApiProperty({
    example: 'johndoe@example.com',
    description: 'Email address of the user initiating registration',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code sent to the email',
  })
  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class CompleteRegisterDto {
  @ApiProperty({
    example: 'johndoe@example.com',
    description: 'Email address of the user completing registration',
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code received and verified in previous step',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'SuperSecurePassword123!',
    description: 'Strong password (minimum 8 characters)',
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: 'SuperSecurePassword123!',
    description: 'Confirmation of the password',
  })
  @IsString()
  @IsNotEmpty()
  confirmPassword: string;

  @ApiPropertyOptional({
    example: 'Acme Corp',
    description: 'Name of the workspace/tenant to create. If not provided, a default one will be created.',
  })
  @IsString()
  @IsOptional()
  tenantName?: string;
}
