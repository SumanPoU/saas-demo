import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class AssignGroupsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  groupIds: string[];
}
