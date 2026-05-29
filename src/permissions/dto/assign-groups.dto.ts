import { IsArray, IsString, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignGroupsDto {
  @ApiProperty({
    description: 'Array of group IDs to assign to the permission',
    example: ['a1b2c3d4-...', 'e5f6g7h8-...'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  groupIds: string[];
}
