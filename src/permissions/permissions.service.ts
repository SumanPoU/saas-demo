import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationService, PaginationQueryDto } from '../common/pagination';
import {
  CreatePermissionDto,
  UpdatePermissionDto,
  CreatePermissionGroupDto,
  UpdatePermissionGroupDto,
} from './dto';

/** Authenticated user context used for tenant-scoped permission operations. */
export interface PermissionsRequestUser {
  id?: string;
  userId?: string;
  tenantId?: string | null;
  isSuperAdmin?: boolean;
}

type RolePermissionWithRole = {
  role?: { id: string; name: string } | null;
};

@Injectable()
export class PermissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
  ) {}

  private withRolesFromRolePermissions<
    T extends { rolePermissions?: RolePermissionWithRole[] },
  >(permission: T) {
    return {
      ...permission,
      roles:
        permission.rolePermissions
          ?.map((rolePermission) => rolePermission.role)
          .filter(Boolean) ?? [],
    };
  }

  /**
   * Build a tenant-scoped permission lookup. Non–super-admins always filter
   * by tenantId so cross-tenant IDs resolve as NotFound (no existence leak).
   */
  private buildTenantScopedPermissionWhere(
    id: string,
    reqUser?: PermissionsRequestUser,
  ): Prisma.PermissionWhereInput {
    const where: Prisma.PermissionWhereInput = { id };
    if (reqUser && !reqUser.isSuperAdmin) {
      where.tenantId = reqUser.tenantId ?? undefined;
    }
    return where;
  }

  private buildTenantScopedGroupWhere(
    id: string,
    reqUser?: PermissionsRequestUser,
  ): Prisma.PermissionGroupWhereInput {
    const where: Prisma.PermissionGroupWhereInput = { id };
    if (reqUser && !reqUser.isSuperAdmin) {
      where.tenantId = reqUser.tenantId ?? undefined;
    }
    return where;
  }

  /**
   * Create Permission
   * Validates name uniqueness and persists a new permission, optionally
   * recording which admin created it.
   */
  async createPermission(
    dto: CreatePermissionDto,
    reqUser?: PermissionsRequestUser,
  ) {
    const tenantId = reqUser?.isSuperAdmin
      ? (dto as CreatePermissionDto & { tenantId?: string }).tenantId ||
        reqUser?.tenantId
      : reqUser?.tenantId;
    const existingPermission = await this.prisma.permission.findFirst({
      where: { name: dto.name, tenantId: tenantId ?? undefined },
    });

    if (existingPermission) {
      throw new BadRequestException(`Permission "${dto.name}" already exists`);
    }

    const permission = await this.prisma.permission.create({
      data: {
        name: dto.name,
        description: dto.description,
        createdBy: reqUser?.id || reqUser?.userId,
        tenantId: tenantId ?? undefined,
      },
      include: {
        groups: true,
        rolePermissions: {
          include: { role: true },
        },
        createdUser: { select: { id: true, username: true } },
      },
    });

    return this.withRolesFromRolePermissions(permission);
  }

  /**
   * Get All Permissions
   * Returns every permission ordered by creation date, including their
   * associated groups, roles, and the admin who created each entry.
   */
  async getAllPermissions(
    query: PaginationQueryDto,
    reqUser?: PermissionsRequestUser,
  ) {
    const where: Prisma.PermissionWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (reqUser && !reqUser.isSuperAdmin) {
      where.tenantId = reqUser.tenantId ?? undefined;
    }

    const result = await this.pagination.paginate(
      this.prisma.permission,
      query,
      {
        where,
        include: {
          groups: true,
          rolePermissions: {
            include: { role: true },
          },
          createdUser: { select: { id: true, username: true } },
        },
        orderBy: { name: 'asc' },
      },
    );

    return {
      ...result,
      data: result.data.map((permission) =>
        this.withRolesFromRolePermissions(permission),
      ),
    };
  }

  /**
   * Get Permission By ID
   * Fetches a single permission with its groups, roles, and creator.
   * Throws NotFoundException if the permission does not exist under this tenant.
   */
  async getPermissionById(id: string, reqUser?: PermissionsRequestUser) {
    const permission = await this.prisma.permission.findFirst({
      where: this.buildTenantScopedPermissionWhere(id, reqUser),
      include: {
        groups: true,
        rolePermissions: {
          include: { role: true },
        },
        createdUser: { select: { id: true, username: true } },
      },
    });

    if (!permission) {
      throw new NotFoundException(`Permission with ID "${id}" not found`);
    }

    return this.withRolesFromRolePermissions(permission);
  }

  /**
   * Update Permission
   * Validates name uniqueness when renaming, skipping the check against
   * itself, then applies the partial update to name or description.
   */
  async updatePermission(
    id: string,
    dto: UpdatePermissionDto,
    reqUser: PermissionsRequestUser,
  ) {
    const existing = await this.getPermissionById(id, reqUser);

    if (dto.name) {
      const existingPermission = await this.prisma.permission.findFirst({
        where: {
          name: dto.name,
          tenantId: existing.tenantId,
        },
      });

      if (existingPermission && existingPermission.id !== id) {
        throw new BadRequestException(
          `Permission "${dto.name}" already exists`,
        );
      }
    }

    const permission = await this.prisma.permission.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: {
        groups: true,
        rolePermissions: {
          include: { role: true },
        },
      },
    });

    return this.withRolesFromRolePermissions(permission);
  }

  /**
   * Delete Permission
   * Blocks deletion if the permission is currently assigned to any roles.
   * Permanently removes the permission record.
   */
  async deletePermission(id: string, reqUser: PermissionsRequestUser) {
    await this.getPermissionById(id, reqUser);

    const rolesWithPermission = await this.prisma.rolePermission.count({
      where: { permissionId: id },
    });

    if (rolesWithPermission > 0) {
      throw new BadRequestException(
        `Cannot delete permission because it is assigned to ${rolesWithPermission} role(s)`,
      );
    }

    return this.prisma.permission.delete({
      where: { id },
    });
  }

  /**
   * Assign Permission to Groups
   * Validates all group IDs exist, then connects the permission to each
   * group. Already-assigned groups are unaffected (Prisma connect is idempotent).
   */
  async assignPermissionToGroup(
    permissionId: string,
    groupIds: string[],
    reqUser: PermissionsRequestUser,
  ) {
    await this.getPermissionById(permissionId, reqUser);

    const groupWhere: Prisma.PermissionGroupWhereInput = {
      id: { in: groupIds },
    };
    if (!reqUser.isSuperAdmin) {
      groupWhere.tenantId = reqUser.tenantId ?? undefined;
    }

    const groups = await this.prisma.permissionGroup.findMany({
      where: groupWhere,
    });

    if (groups.length !== groupIds.length) {
      throw new BadRequestException('One or more group IDs do not exist');
    }

    return this.prisma.permission.update({
      where: { id: permissionId },
      data: {
        groups: {
          connect: groupIds.map((gid) => ({ id: gid })),
        },
      },
      include: { groups: true },
    });
  }

  /**
   * Remove Permission from Groups
   * Disconnects the permission from each specified group.
   * Groups that do not have the permission are silently skipped.
   */
  async removePermissionFromGroup(
    permissionId: string,
    groupIds: string[],
    reqUser: PermissionsRequestUser,
  ) {
    await this.getPermissionById(permissionId, reqUser);

    return this.prisma.permission.update({
      where: { id: permissionId },
      data: {
        groups: {
          disconnect: groupIds.map((gid) => ({ id: gid })),
        },
      },
      include: { groups: true },
    });
  }

  /**
   * Create Permission Group
   * Validates group name uniqueness and persists a new permission group,
   * optionally recording which admin created it.
   */
  async createPermissionGroup(
    dto: CreatePermissionGroupDto,
    reqUser?: PermissionsRequestUser,
  ) {
    const tenantId = reqUser?.isSuperAdmin
      ? (dto as CreatePermissionGroupDto & { tenantId?: string }).tenantId ||
        reqUser?.tenantId
      : reqUser?.tenantId;
    const existingGroup = await this.prisma.permissionGroup.findFirst({
      where: { name: dto.name, tenantId: tenantId ?? undefined },
    });

    if (existingGroup) {
      throw new BadRequestException(
        `Permission group "${dto.name}" already exists`,
      );
    }

    return this.prisma.permissionGroup.create({
      data: {
        name: dto.name,
        description: dto.description,
        createdBy: reqUser?.id || reqUser?.userId,
        tenantId: tenantId ?? undefined,
      },
      include: {
        permissions: true,
        createdUser: { select: { id: true, username: true } },
      },
    });
  }

  /**
   * Get All Permission Groups
   * Returns every permission group ordered by creation date, including
   * their associated permissions and the admin who created each group.
   */
  async getAllPermissionGroups(reqUser?: PermissionsRequestUser) {
    const where: Prisma.PermissionGroupWhereInput = {};
    if (reqUser && !reqUser.isSuperAdmin) {
      where.tenantId = reqUser.tenantId ?? undefined;
    }

    return this.prisma.permissionGroup.findMany({
      where,
      include: {
        permissions: true,
        createdUser: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get Permission Group By ID
   * Fetches a single group with its permissions and creator details.
   * Throws NotFoundException if the group does not exist under this tenant.
   */
  async getPermissionGroupById(id: string, reqUser?: PermissionsRequestUser) {
    const group = await this.prisma.permissionGroup.findFirst({
      where: this.buildTenantScopedGroupWhere(id, reqUser),
      include: {
        permissions: true,
        createdUser: { select: { id: true, username: true } },
      },
    });

    if (!group) {
      throw new NotFoundException(`Permission group with ID "${id}" not found`);
    }

    return group;
  }

  /**
   * Update Permission Group
   * Validates name uniqueness when renaming, skipping the check against
   * itself, then applies the partial update to name or description.
   */
  async updatePermissionGroup(
    id: string,
    dto: UpdatePermissionGroupDto,
    reqUser: PermissionsRequestUser,
  ) {
    const existing = await this.getPermissionGroupById(id, reqUser);

    if (dto.name) {
      const existingGroup = await this.prisma.permissionGroup.findFirst({
        where: {
          name: dto.name,
          tenantId: existing.tenantId,
        },
      });

      if (existingGroup && existingGroup.id !== id) {
        throw new BadRequestException(
          `Permission group "${dto.name}" already exists`,
        );
      }
    }

    return this.prisma.permissionGroup.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: {
        permissions: true,
      },
    });
  }

  /**
   * Delete Permission Group
   * Permanently removes the permission group. Permissions within the group
   * are not deleted — only the group container is removed.
   */
  async deletePermissionGroup(id: string, reqUser: PermissionsRequestUser) {
    await this.getPermissionGroupById(id, reqUser);

    return this.prisma.permissionGroup.delete({
      where: { id },
    });
  }
}
