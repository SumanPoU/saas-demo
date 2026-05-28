import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecoverMfaDto {
  @ApiProperty({ example: 'johndoe@example.com', description: 'Email address of the account requesting recovery' })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
