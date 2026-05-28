import { IsNotEmpty, IsNumberString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyMfaSetupDto {
  @ApiProperty({ example: '123456', description: '6-digit verification code from authenticator app' })
  @IsNumberString()
  @Length(6, 6, { message: 'Code must be exactly 6 digits long' })
  @IsNotEmpty()
  code: string;
}
