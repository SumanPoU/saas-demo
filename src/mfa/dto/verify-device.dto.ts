import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyDeviceDto {
  @ApiProperty({ example: 'a9f7e5...', description: 'Device authorization verification token received in email' })
  @IsString()
  @IsNotEmpty()
  token: string;
}
