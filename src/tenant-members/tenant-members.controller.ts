import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { TenantMembersService } from './tenant-members.service';
import {
  InviteMemberDto,
  AcceptInvitationDto,
  UpdateMemberDto,
} from './dto/tenant-members.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequestUser } from '../auth/interfaces/request-user.interface';
import { TenantMemberGuard } from '../auth/guards/tenant-member.guard';
import { TenantOwnerGuard } from '../auth/guards/tenant-owner.guard';

@ApiTags('Tenant Members')
@Controller()
export class TenantMembersController {
  constructor(private readonly membersService: TenantMembersService) {}

  /**
   * Endpoint to invite a new user to a specific tenant workspace.
   * Access is restricted to Tenant Owners.
   * Sends an email invitation asynchronously.
   *
   * @param tenantId UUID of the target workspace
   * @param dto Contains email and role assigned to the new invitee
   * @param user The owner user executing the invite
   */
  @Post('tenants/:tenantId/members/invite')
  @ApiBearerAuth('JWT')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({
    summary: 'Invite a new member to the workspace (Owner only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Member invited successfully',
    schema: {
      example: {
        statusCode: 201,
        message: 'Member invited successfully',
        data: {
          id: 'invite-id',
          email: 'newmember@example.com',
          roleId: 'role-id',
          expiresAt: '2026-06-23T00:00:00Z',
        },
      },
    },
  })
  inviteMember(
    @Param('tenantId') tenantId: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: any,
  ) {
    return this.membersService.inviteMember(
      tenantId,
      dto,
      user.userId || user.id,
    );
  }

  /**
   * Endpoint for users to accept a workspace invitation via the token
   * received in their email. Converts a pending TenantInvitation into
   * an active TenantMembership.
   *
   * @param dto Payload containing the unique invitation token
   */
  @Post('auth/invitations/accept')
  @ApiOperation({ summary: 'Accept a workspace invitation' })
  @ApiResponse({
    status: 200,
    description: 'Invitation accepted successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Invitation accepted successfully',
        data: {
          tenantId: 'tenant-id',
          userId: 'user-id',
          isOwner: false,
        },
      },
    },
  })
  acceptInvitation(@Body() dto: AcceptInvitationDto) {
    return this.membersService.acceptInvitation(dto);
  }

  @Get('tenants/:tenantId/members')
  @ApiBearerAuth('JWT')
  @UseGuards(TenantMemberGuard)
  @ApiOperation({ summary: 'List all members in the workspace' })
  @ApiResponse({
    status: 200,
    description: 'Members retrieved successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Members retrieved successfully',
        data: [
          {
            userId: 'user-id',
            tenantId: 'tenant-id',
            isOwner: true,
            user: {
              email: 'owner@example.com',
              username: 'owner',
            },
          },
        ],
      },
    },
  })
  getMembers(@Param('tenantId') tenantId: string) {
    return this.membersService.getMembers(tenantId);
  }

  @Patch('tenants/:tenantId/members/:userId')
  @ApiBearerAuth('JWT')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({
    summary: 'Update a member role or owner status (Owner only)',
  })
  @ApiResponse({
    status: 200,
    description: 'Member updated successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Member updated successfully',
        data: {
          userId: 'user-id',
          tenantId: 'tenant-id',
          isOwner: false,
          roleId: 'new-role-id',
        },
      },
    },
  })
  updateMember(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.membersService.updateMember(tenantId, userId, dto);
  }

  @Delete('tenants/:tenantId/members/:userId')
  @ApiBearerAuth('JWT')
  @UseGuards(TenantOwnerGuard)
  @ApiOperation({ summary: 'Remove a member from the workspace (Owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Member removed successfully',
    schema: {
      example: {
        statusCode: 200,
        message: 'Member removed successfully',
        data: null,
      },
    },
  })
  removeMember(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.membersService.removeMember(
      tenantId,
      userId,
      user.userId || user.id,
    );
  }
}
