import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class AssignUsersDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  userIds: string[];
}
