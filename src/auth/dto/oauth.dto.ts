import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OAuthDto {
  @ApiProperty({
    example: '4/0AdQt8q...',
    description:
      'Authorization code returned from Google or GitHub OAuth server',
  })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({
    example: 'xyz123',
    description: 'The state parameter returned by the OAuth provider',
  })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({
    example: 'xyz123',
    description:
      'The expected state parameter stored by the client to verify against CSRF',
  })
  @IsString()
  @IsNotEmpty()
  expectedState: string;
}
