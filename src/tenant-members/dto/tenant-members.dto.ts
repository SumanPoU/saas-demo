import { IsString, IsEmail, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class InviteMemberDto {
  @ApiProperty({ description: 'Email address of the user to invite' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Role ID to assign to the user upon joining',
  })
  @IsOptional()
  @IsString()
  roleId?: string;
}

export class AcceptInvitationDto {
  @ApiProperty({ description: 'The unique token sent to the user email' })
  @IsString()
  token: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ description: 'Set whether the member is an owner' })
  @IsOptional()
  @IsBoolean()
  isOwner?: boolean;

  @ApiPropertyOptional({ description: 'Role ID to assign to the member' })
  @IsOptional()
  @IsString()
  roleId?: string;
}
