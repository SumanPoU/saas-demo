import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  InviteMemberDto,
  AcceptInvitationDto,
  UpdateMemberDto,
} from './dto/tenant-members.dto';
import { MailService } from '../mail/mail.service';
import * as crypto from 'crypto';
import { UsersService } from '../users/users.service';

@Injectable()
export class TenantMembersService {
  constructor(
    private prisma: PrismaService,
    private mailService: MailService,
    private usersService: UsersService,
  ) {}

  /**
   * Invites a new user to the tenant workspace.
   * Validates if the user is already a member before generating
   * an invitation token and creating a TenantInvitation record.
   *
   * @param tenantId The unique identifier of the tenant
   * @param dto Data Transfer Object containing email and roleId
   * @param inviterId The ID of the user sending the invitation
   * @returns An object containing the success message and token
   */
  async inviteMember(
    tenantId: string,
    dto: InviteMemberDto,
    inviterId: string,
  ) {
    const email = dto.email.toLowerCase();

    // Check if already a member
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      const isMember = await this.prisma.tenantMembership.findUnique({
        where: { tenantId_userId: { tenantId, userId: existingUser.id } },
      });
      if (isMember)
        throw new ConflictException(
          'User is already a member of this workspace',
        );
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await this.prisma.tenantInvitation.create({
      data: {
        tenantId,
        email,
        tokenHash: token,
        role: dto.roleId ?? 'member',
        invitedById: inviterId,
        expiresAt,
      },
    });

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    // In a real app, you would send an email with a link to accept the invitation
    // e.g., await this.mailService.sendWorkspaceInvitation(email, tenant.name, token);

    return {
      message: 'Invitation sent successfully',
      token: invitation.tokenHash,
    };
  }

  /**
   * Accepts a pending workspace invitation using a valid token.
   * If the user doesn't exist, a placeholder account is created.
   * Upon success, creates a TenantMembership and removes the invitation.
   *
   * @param dto DTO containing the invitation token
   * @returns The created TenantMembership
   * @throws NotFoundException if the token is invalid
   * @throws BadRequestException if the token is expired
   */
  async acceptInvitation(dto: AcceptInvitationDto) {
    const invitation = await this.prisma.tenantInvitation.findUnique({
      where: { tokenHash: dto.token },
      include: { tenant: true },
    });

    if (!invitation) throw new NotFoundException('Invalid invitation token');
    if (invitation.expiresAt < new Date())
      throw new BadRequestException('Invitation has expired');

    return this.prisma.$transaction(async (tx) => {
      let user: any = await tx.user.findUnique({
        where: { email: invitation.email },
      });

      if (!user) {
        // We could create the user here, or require them to register first.
        // Let's create a placeholder user that requires password change
        const randomPassword = crypto.randomBytes(12).toString('base64url');
        user = await this.usersService.createUser(
          {
            email: invitation.email,
            firstName: 'Invited',
            lastName: 'User',
            isActive: true,
            roleIds: [],
          } as any,
          invitation.invitedById || 'system',
        );
      }

      // Add to tenant
      await tx.tenantMembership.create({
        data: {
          tenantId: invitation.tenantId,
          userId: user.id,
          isOwner: false,
        },
      });

      if (invitation.role && invitation.role !== 'member') {
        await tx.user.update({
          where: { id: user.id },
          data: { roles: { connect: { id: invitation.role } } },
        });
      }

      // Delete invitation
      await tx.tenantInvitation.delete({ where: { id: invitation.id } });

      return {
        message: 'Joined workspace successfully',
        tenantId: invitation.tenantId,
      };
    });
  }

  async getMembers(tenantId: string) {
    return this.prisma.tenantMembership.findMany({
      where: { tenantId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            roles: { where: { tenantId }, select: { name: true } },
          },
        },
      },
    });
  }

  async updateMember(tenantId: string, userId: string, dto: UpdateMemberDto) {
    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
    if (!membership) throw new NotFoundException('Member not found');

    if (dto.isOwner !== undefined) {
      await this.prisma.tenantMembership.update({
        where: { tenantId_userId: { tenantId, userId } },
        data: { isOwner: dto.isOwner },
      });
    }

    if (dto.roleId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { roles: { connect: { id: dto.roleId } } },
      });
    }

    return { message: 'Member updated successfully' };
  }

  async removeMember(tenantId: string, userId: string, currentUserId: string) {
    if (userId === currentUserId)
      throw new BadRequestException(
        'You cannot remove yourself. Leave the workspace instead.',
      );

    const membership = await this.prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });

    if (!membership) throw new NotFoundException('Member not found');

    if (membership.isOwner) {
      // Check if there are other owners
      const ownerCount = await this.prisma.tenantMembership.count({
        where: { tenantId, isOwner: true },
      });
      if (ownerCount <= 1)
        throw new BadRequestException(
          'Cannot remove the last owner of the workspace',
        );
    }

    await this.prisma.tenantMembership.delete({
      where: { tenantId_userId: { tenantId, userId } },
    });

    return { message: 'Member removed successfully' };
  }
}
