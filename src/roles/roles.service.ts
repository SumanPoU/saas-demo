import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto, UpdateRoleDto } from './dto';

/** Authenticated user context used for tenant-scoped role operations. */
export interface RolesRequestUser {
  id: string;
  tenantId?: string | null;
  isSuperAdmin?: boolean;
}

type RolePermissionWithPermission = {
  permission?: { id: string; name: string } | null;
};

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  private withPermissionsFromRolePermissions<
    T extends { rolePermissions?: RolePermissionWithPermission[] },
  >(role: T) {
    return {
      ...role,
      permissions:
        role.rolePermissions
          ?.map((rolePermission) => rolePermission.permission)
          .filter(Boolean) ?? [],
    };
  }

  /**
   * Build a tenant-scoped role lookup. Non–super-admins always filter by
   * tenantId so cross-tenant IDs resolve as NotFound (no existence leak).
   */
  private buildTenantScopedRoleWhere(
    id: string,
    reqUser?: RolesRequestUser,
  ): Prisma.RoleWhereInput {
    const where: Prisma.RoleWhereInput = { id };
    if (reqUser && !reqUser.isSuperAdmin) {
      where.tenantId = reqUser.tenantId ?? undefined;
    }
    return where;
  }

  /**
   * Guard: Single Default Role Constraint
   * Checks that no other role is already marked as default before allowing
   * isDefault=true to be set. Pass excludeId when updating an existing role
   * to prevent a false conflict against itself.
   */
  private async ensureSingleDefault(
    isDefault: boolean | undefined,
    excludeId?: string,
    tenantId?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    if (!isDefault) return;

    const client = tx ?? this.prisma;

    const existingDefault = await client.role.findFirst({
      where: {
        isDefault: true,
        tenantId,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });

    if (existingDefault) {
      throw new BadRequestException(
        `Role "${existingDefault.name}" is already set as the default. ` +
          `Only one role can be the default. Remove the default flag from that role first.`,
      );
    }
  }

  /**
   * Create Role
   * Validates name uniqueness, enforces the single-default constraint if
   * isDefault is true, and persists the new role with its permissions.
   */
  async createRole(dto: CreateRoleDto, reqUser: RolesRequestUser) {
    const tenantId = reqUser.isSuperAdmin
      ? (dto as CreateRoleDto & { tenantId?: string }).tenantId ||
        reqUser.tenantId
      : reqUser.tenantId;
    const existingRole = await this.prisma.role.findFirst({
      where: { name: dto.name, tenantId: tenantId ?? undefined },
    });

    if (existingRole) {
      throw new BadRequestException(`Role "${dto.name}" already exists`);
    }

    await this.ensureSingleDefault(
      dto.isDefault,
      undefined,
      tenantId ?? undefined,
    );

    const role = await this.prisma.role.create({
      data: {
        name: dto.name,
        description: dto.description,
        isDefault: dto.isDefault ?? false,
        tenantId: tenantId ?? undefined,
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    return this.withPermissionsFromRolePermissions(role);
  }

  /**
   * Get All Roles
   * Returns every role ordered by creation date, including their permissions
   * and the users currently assigned to each role.
   */
  async getAllRoles(reqUser?: RolesRequestUser) {
    const where = reqUser?.isSuperAdmin ? {} : { tenantId: reqUser?.tenantId };

    const roles = await this.prisma.role.findMany({
      where,
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        users: {
          select: { id: true, username: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return roles.map((role) => this.withPermissionsFromRolePermissions(role));
  }

  /**
   * Get Role By ID
   * Fetches a single role with full permission and user details.
   * Throws NotFoundException if the role does not exist under this tenant.
   */
  async getRoleById(id: string, reqUser?: RolesRequestUser) {
    const role = await this.prisma.role.findFirst({
      where: this.buildTenantScopedRoleWhere(id, reqUser),
      include: {
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

    return this.withPermissionsFromRolePermissions(role);
  }

  /**
   * Update Role
   * Validates name uniqueness when renaming, enforces the single-default
   * constraint when promoting to default (excluding itself), and applies
   * the partial update to name, description, or isDefault.
   */
  async updateRole(id: string, dto: UpdateRoleDto, reqUser: RolesRequestUser) {
    const role = await this.getRoleById(id, reqUser);

    if (dto.name && dto.name !== role.name) {
      const existingRole = await this.prisma.role.findFirst({
        where: { name: dto.name, tenantId: role.tenantId },
      });

      if (existingRole) {
        throw new BadRequestException(`Role "${dto.name}" already exists`);
      }
    }

    // Only enforce the constraint when isDefault is being explicitly set to true.
    // If this role is already the default and we're keeping it, excludeId
    // prevents a false conflict against itself.
    await this.ensureSingleDefault(
      dto.isDefault,
      id,
      role.tenantId || undefined,
    );

    const updatedRole = await this.prisma.role.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        isDefault: dto.isDefault,
      },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    return this.withPermissionsFromRolePermissions(updatedRole);
  }

  /**
   * Delete Role
   * Blocks deletion if the role is currently assigned to any users.
   * Permanently removes the role and all associated permission links.
   */
  async deleteRole(id: string, reqUser: RolesRequestUser) {
    const role = await this.getRoleById(id, reqUser);

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

  /**
   * Assign Permissions to Role
   * Validates all permission IDs exist, then upserts each RolePermission
   * record so the operation is idempotent for already-assigned permissions.
   */
  async assignPermissionsToRole(
    roleId: string,
    permissionIds: string[],
    reqUser: RolesRequestUser,
    assignedById?: string,
  ) {
    const role = await this.getRoleById(roleId, reqUser);

    const permissionWhere: Prisma.PermissionWhereInput = {
      id: { in: permissionIds },
    };
    if (!reqUser.isSuperAdmin) {
      permissionWhere.tenantId = reqUser.tenantId ?? undefined;
    }

    const permissions = await this.prisma.permission.findMany({
      where: permissionWhere,
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
      rolePermissions,
      permissions: rolePermissions.map(
        (rolePermission) => rolePermission.permission,
      ),
    };
  }

  /**
   * Remove Permissions from Role
   * Bulk-deletes the specified RolePermission records from the role.
   * Silently skips IDs that were never assigned.
   */
  async removePermissionsFromRole(
    roleId: string,
    permissionIds: string[],
    reqUser: RolesRequestUser,
  ) {
    const role = await this.getRoleById(roleId, reqUser);

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

  /**
   * Assign Role to Users
   * Validates all user IDs exist, then connects the role to each user.
   * Already-assigned users are unaffected (Prisma connect is idempotent).
   */
  async assignRoleToUsers(
    roleId: string,
    userIds: string[],
    reqUser: RolesRequestUser,
  ) {
    const role = await this.getRoleById(roleId, reqUser);

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

  /**
   * Remove Role from Users
   * Disconnects the role from each specified user.
   * Users who do not have the role are silently skipped.
   */
  async removeRoleFromUsers(
    roleId: string,
    userIds: string[],
    reqUser: RolesRequestUser,
  ) {
    const role = await this.getRoleById(roleId, reqUser);

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

  /**
   * Get User Roles
   * Returns all roles assigned to a user, each populated with their
   * permissions. Throws NotFoundException if the user does not exist.
   */
  async getUserRoles(userId: string, reqUser?: RolesRequestUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        roles: reqUser?.isSuperAdmin
          ? { include: { rolePermissions: { include: { permission: true } } } }
          : {
              where: { tenantId: reqUser?.tenantId ?? undefined },
              include: {
                rolePermissions: { include: { permission: true } },
              },
            },
      },
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    return user.roles.map((role) =>
      this.withPermissionsFromRolePermissions(role),
    );
  }

  /**
   * Check User Has Role
   * Returns true if the user holds at least one of the supplied role names.
   * Returns false (no exception) if the user does not exist.
   */
  async checkUserHasRole(
    userId: string,
    roleNames: string[],
  ): Promise<boolean> {
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

  /**
   * Get Default Role
   * Retrieves the single role marked as isDefault=true, including its
   * permissions. Returns null if no default role has been configured.
   */
  async getDefaultRole() {
    const role = await this.prisma.role.findFirst({
      where: { isDefault: true },
      include: {
        rolePermissions: { include: { permission: true } },
      },
    });

    return role ? this.withPermissionsFromRolePermissions(role) : null;
  }
}
