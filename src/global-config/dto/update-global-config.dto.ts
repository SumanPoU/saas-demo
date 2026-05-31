import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateGlobalConfigDto {
  @ApiPropertyOptional({ example: 'system' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiProperty({
    example: {
      name: 'SaaS Enterprise Demo',
      frontendUrl: 'http://localhost:3000',
    },
  })
  @IsObject()
  value: Record<string, unknown>;
}
