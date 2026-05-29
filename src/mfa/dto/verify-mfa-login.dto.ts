import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyMfaLoginDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'MFA pending JWT token returned during credential login',
  })
  @IsString()
  @IsNotEmpty()
  mfaPendingToken: string;

  @ApiProperty({
    example: '123456',
    description:
      '6-digit TOTP verification code or 8-character alphanumeric backup code',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
