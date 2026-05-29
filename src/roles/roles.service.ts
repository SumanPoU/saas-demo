import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async createRole(dto: CreateRoleDto, createdById?: string) {
    const existingRole = await this.prisma.role.findUnique({
      where: { name: dto.name },
    });

    if (existingRole) {
      throw new BadRequestException(`Role "${dto.name}" already exists`);
    }

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        isDefault: dto.isDefault ?? false,
      },
      include: {
        permissions: true,
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    return role;
  }

  async getAllRoles() {
    return this.prisma.role.findMany({
      include: {
        permissions: true,
        rolePermissions: {
          include: { permission: true },
        },
        users: {
          select: { id: true, username: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRoleById(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: true,
        rolePermissions: {
          include: {
            permission: true,
            assignedBy: { select: { id: true, username: true, email: true } },
          },
        },
        users: {
          select: { id: true, username: true, email: true },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role with ID "${id}" not found`);
    }

    return role;
  }

  async updateRole(id: string, dto: UpdateRoleDto) {
    const role = await this.getRoleById(id);

    if (dto.name && dto.name !== role.name) {
      const existingRole = await this.prisma.role.findUnique({
        where: { name: dto.name },
      });

      if (existingRole) {
        throw new BadRequestException(`Role "${dto.name}" already exists`);
      }
    }

    return this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isDefault: dto.isDefault,
      },
      include: {
        permissions: true,
        rolePermissions: {
          include: { permission: true },
        },
      },
    });
  }

  async deleteRole(id: string) {
    const role = await this.getRoleById(id);

    const usersWithRole = await this.prisma.user.count({
      where: {
        roles: {
          some: { id },
        },
      },
    });

    if (usersWithRole > 0) {
      throw new BadRequestException(
        `Cannot delete role "${role.name}" because it is assigned to ${usersWithRole} user(s)`,
      );
    }

    return this.prisma.role.delete({
      where: { id },
    });
  }

  async assignPermissionsToRole(
    roleId: string,
    permissionIds: string[],
    assignedById?: string,
  ) {
    const role = await this.getRoleById(roleId);

    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: permissionIds } },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permission IDs do not exist');
    }

    const rolePermissions = await Promise.all(
      permissionIds.map((permissionId) =>
        this.prisma.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId,
              permissionId,
            },
          },
          create: {
            roleId,
            permissionId,
            assignedById,
          },
          update: {},
          include: {
            permission: true,
            assignedBy: { select: { id: true, username: true } },
          },
        }),
      ),
    );

    return {
      roleId,
      role: role.name,
      permissions: rolePermissions,
    };
  }

  async removePermissionsFromRole(roleId: string, permissionIds: string[]) {
    const role = await this.getRoleById(roleId);

    await this.prisma.rolePermission.deleteMany({
      where: {
        roleId,
        permissionId: { in: permissionIds },
      },
    });

    return {
      roleId,
      role: role.name,
      message: `Removed ${permissionIds.length} permission(s)`,
    };
  }

  async assignRoleToUsers(roleId: string, userIds: string[]) {
    const role = await this.getRoleById(roleId);

    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
    });

    if (users.length !== userIds.length) {
      throw new BadRequestException('One or more user IDs do not exist');
    }

    const updatedUsers = await Promise.all(
      userIds.map((userId) =>
        this.prisma.user.update({
          where: { id: userId },
          data: {
            roles: {
              connect: { id: roleId },
            },
          },
          select: { id: true, username: true, email: true },
        }),
      ),
    );

    return {
      roleId,
      role: role.name,
      users: updatedUsers,
      message: `Assigned role to ${updatedUsers.length} user(s)`,
    };
  }

  async removeRoleFromUsers(roleId: string, userIds: string[]) {
    const role = await this.getRoleById(roleId);

    const updatedUsers = await Promise.all(
      userIds.map((userId) =>
        this.prisma.user.update({
          where: { id: userId },
          data: {
            roles: {
              disconnect: { id: roleId },
            },
          },
          select: { id: true, username: true, email: true },
        }),
      ),
    );

    return {
      roleId,
      role: role.name,
      users: updatedUsers,
      message: `Removed role from ${updatedUsers.length} user(s)`,
    };
  }

  async getUserRoles(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          include: {
            permissions: true,
            rolePermissions: { include: { permission: true } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    return user.roles;
  }

  async checkUserHasRole(userId: string, roleNames: string[]): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: {
          select: { name: true },
        },
      },
    });

    if (!user) {
      return false;
    }

    return roleNames.some((roleName) =>
      user.roles.some((r) => r.name === roleName),
    );
  }

  async getDefaultRole() {
    return this.prisma.role.findFirst({
      where: { isDefault: true },
      include: {
        permissions: true,
        rolePermissions: { include: { permission: true } },
      },
    });
  }
}
