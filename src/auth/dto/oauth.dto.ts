import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OAuthDto {
  @ApiProperty({ example: '4/0AdQt8q...', description: 'Authorization code returned from Google or GitHub OAuth server' })
  @IsString()
  @IsNotEmpty()
  code: string;
}
