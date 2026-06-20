import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SwitchTenantDto {
  @ApiProperty({ description: 'The UUID of the tenant to switch into' })
  @IsUUID()
  tenantId: string;
}
