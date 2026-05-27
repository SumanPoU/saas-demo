import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendOtpDto {
  @ApiProperty({ example: 'johndoe@example.com', description: 'Valid email address associated with the pending registration' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
