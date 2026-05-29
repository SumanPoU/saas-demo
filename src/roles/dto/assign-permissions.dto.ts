import { IsArray, IsString, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignPermissionsDto {
  @ApiProperty({
    example: ['perm-id-1', 'perm-id-2'],
    description: 'Permission IDs to assign to the role',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  permissionIds: string[];
}
