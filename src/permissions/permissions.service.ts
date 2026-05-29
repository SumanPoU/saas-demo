import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePermissionDto, UpdatePermissionDto, CreatePermissionGroupDto, UpdatePermissionGroupDto } from './dto';

@Injectable()
export class PermissionsService {
  constructor(private prisma: PrismaService) {}

  async createPermission(dto: CreatePermissionDto, createdById?: string) {
    const existingPermission = await this.prisma.permission.findUnique({
      where: { name: dto.name },
    });

    if (existingPermission) {
      throw new BadRequestException(
        `Permission "${dto.name}" already exists`,
      );
    }

    return this.prisma.permission.create({
      data: {
        name: dto.name,
        description: dto.description,
        createdBy: createdById,
      },
      include: {
        groups: true,
        roles: true,
        createdUser: { select: { id: true, username: true } },
      },
    });
  }

  async getAllPermissions() {
    return this.prisma.permission.findMany({
      include: {
        groups: true,
        roles: true,
        createdUser: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPermissionById(id: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
      include: {
        groups: true,
        roles: true,
        createdUser: { select: { id: true, username: true } },
      },
    });

    if (!permission) {
      throw new NotFoundException(`Permission with ID "${id}" not found`);
    }

    return permission;
  }

  async updatePermission(id: string, dto: UpdatePermissionDto) {
    await this.getPermissionById(id);

    if (dto.name) {
      const existingPermission = await this.prisma.permission.findUnique({
        where: { name: dto.name },
      });

      if (existingPermission && existingPermission.id !== id) {
        throw new BadRequestException(
          `Permission "${dto.name}" already exists`,
        );
      }
    }

    return this.prisma.permission.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
      },
      include: {
        groups: true,
        roles: true,
      },
    });
  }

  async deletePermission(id: string) {
    await this.getPermissionById(id);

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

  async assignPermissionToGroup(
    permissionId: string,
    groupIds: string[],
  ) {
    await this.getPermissionById(permissionId);

    const groups = await this.prisma.permissionGroup.findMany({
      where: { id: { in: groupIds } },
    });

    if (groups.length !== groupIds.length) {
      throw new BadRequestException('One or more group IDs do not exist');
    }

    const updatedPermission = await this.prisma.permission.update({
      where: { id: permissionId },
      data: {
        groups: {
          connect: groupIds.map((gid) => ({ id: gid })),
        },
      },
      include: { groups: true },
    });

    return updatedPermission;
  }

  async removePermissionFromGroup(
    permissionId: string,
    groupIds: string[],
  ) {
    await this.getPermissionById(permissionId);

    const updatedPermission = await this.prisma.permission.update({
      where: { id: permissionId },
      data: {
        groups: {
          disconnect: groupIds.map((gid) => ({ id: gid })),
        },
      },
      include: { groups: true },
    });

    return updatedPermission;
  }

  async createPermissionGroup(
    dto: CreatePermissionGroupDto,
    createdById?: string,
  ) {
    const existingGroup = await this.prisma.permissionGroup.findUnique({
      where: { name: dto.name },
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
        createdBy: createdById,
      },
      include: {
        permissions: true,
        createdUser: { select: { id: true, username: true } },
      },
    });
  }

  async getAllPermissionGroups() {
    return this.prisma.permissionGroup.findMany({
      include: {
        permissions: true,
        createdUser: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPermissionGroupById(id: string) {
    const group = await this.prisma.permissionGroup.findUnique({
      where: { id },
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

  async updatePermissionGroup(
    id: string,
    dto: UpdatePermissionGroupDto,
  ) {
    await this.getPermissionGroupById(id);

    if (dto.name) {
      const existingGroup = await this.prisma.permissionGroup.findUnique({
        where: { name: dto.name },
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

  async deletePermissionGroup(id: string) {
    await this.getPermissionGroupById(id);

    return this.prisma.permissionGroup.delete({
      where: { id },
    });
  }
}
