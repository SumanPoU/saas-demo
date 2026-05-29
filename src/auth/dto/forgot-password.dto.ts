import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'johndoe@example.com',
    description: 'Username or email address of the user account',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
