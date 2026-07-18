import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const safeUserSelect = {
  id: true,
  username: true,
  email: true,
  emailVerified: true,
  firstName: true,
  lastName: true,
  avatarUrl: true,
  isActive: true,
  isSuperAdmin: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    select: {
      id: true,
      name: true,
      description: true,
    },
  },
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma;
  }

  findExistingByEmailOrUsername(email: string, username: string) {
    return this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });
  }

  findRolesByIds(roleIds: string[]) {
    return this.prisma.role.findMany({ where: { id: { in: roleIds } } });
  }

  findDefaultRole() {
    return this.prisma.role.findFirst({ where: { isDefault: true } });
  }

  createUser(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data,
      select: safeUserSelect,
    });
  }

  findFirst(args: {
    where: Prisma.UserWhereInput;
    select?: Prisma.UserSelect;
  }) {
    return this.prisma.user.findFirst({
      where: args.where,
      select: args.select ?? safeUserSelect,
    });
  }

  updateUser(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: safeUserSelect,
    });
  }

  updatePassword(id: string, passwordHash: string) {
    return this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: true,
      },
    });
  }

  revokeSessions(userId: string, revokedBy: string) {
    return this.prisma.userSession.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date(), revokedBy },
    });
  }

  revokeRefreshTokens(userId: string) {
    return this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });
  }

  createAuditLog(data: {
    actorId: string;
    action: string;
    entityType: string;
    entityId: string;
  }) {
    return this.prisma.auditLog.create({ data });
  }
}
