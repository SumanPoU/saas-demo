import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OAuthDto {
  @ApiProperty({ example: '4/0AdQt8q...', description: 'Authorization code returned from Google or GitHub OAuth server' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional({ example: 'xyz123', description: 'The state parameter returned by the OAuth provider' })
  @IsOptional()
  @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'xyz123', description: 'The expected state parameter stored by the client to verify against CSRF' })
  @IsOptional()
  @IsString()
  expectedState?: string;
}
