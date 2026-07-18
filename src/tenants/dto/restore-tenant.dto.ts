import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RestoreTenantDto {
  @ApiProperty({
    description:
      'Restoration token emailed when the workspace was soft-deleted',
    example: 'a1b2c3d4e5f6...',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
