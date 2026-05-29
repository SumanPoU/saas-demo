import { IsArray, IsString, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignUsersDto {
  @ApiProperty({
    example: ['user-id-1', 'user-id-2'],
    description: 'User IDs to assign to the role',
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  userIds: string[];
}
