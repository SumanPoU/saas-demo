import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'johndoe',
    description: 'Username or email address of the user',
  })
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @ApiProperty({
    example: 'SuperSecurePassword123!',
    description: 'User password',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}
