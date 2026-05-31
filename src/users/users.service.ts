import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationService, PaginationQueryDto } from '../common/pagination';
import { MailService } from '../mail/mail.service';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { CreateUserDto, UpdateUserDto } from './dto';

const safeUserSelect = {
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
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
    private readonly mailService: MailService,
    private readonly runtimeConfig: RuntimeConfigService,
  ) {}

  private generateTemporaryPassword() {
    const random = crypto.randomBytes(18).toString('base64url');
    return `Temp-${random}1!`;
  }

  private deriveUsername(email: string, username?: string) {
    return (username ?? email.split('@')[0])
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  }

  async createUser(dto: CreateUserDto, actorId: string) {
    const email = dto.email.toLowerCase();
    const username = this.deriveUsername(email, dto.username);

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });

    if (existing) {
      throw new ConflictException('User email or username already exists');
    }

    const roles = dto.roleIds?.length
      ? await this.prisma.role.findMany({ where: { id: { in: dto.roleIds } } })
      : [];

    if (dto.roleIds?.length && roles.length !== dto.roleIds.length) {
      throw new BadRequestException('One or more role IDs do not exist');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const saltRounds = await this.runtimeConfig.getBcryptSaltRounds();
    const passwordHash = await bcrypt.hash(temporaryPassword, saltRounds);

    const defaultRole = dto.roleIds?.length
      ? null
      : await this.prisma.role.findFirst({ where: { isDefault: true } });

    const user = await this.prisma.user.create({
      data: {
        email,
        username,
        firstName: dto.firstName,
        lastName: dto.lastName,
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: true,
        isActive: dto.isActive ?? true,
        emailVerified: true,
        roles: {
          connect: dto.roleIds?.length
            ? dto.roleIds.map((id) => ({ id }))
            : defaultRole
              ? [{ id: defaultRole.id }]
              : [],
        },
      },
      select: safeUserSelect,
    });

    await this.mailService.sendTemporaryPassword(
      user.email,
      temporaryPassword,
      user.firstName ?? undefined,
    );

    await this.prisma.auditLog.create({
      data: {
        tenantId: 'default',
        actorId,
        action: 'USER_CREATE',
        entityType: 'User',
        entityId: user.id,
      },
    });

    return user;
  }

  async getUsers(query: PaginationQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

    return this.pagination.paginate(this.prisma.user, query, {
      where,
      select: safeUserSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: safeUserSelect,
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    return user;
  }

  async updateUser(id: string, dto: UpdateUserDto) {
    await this.getUserById(id);

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: safeUserSelect,
    });
  }

  async resetUserPassword(id: string, actorId: string) {
    const user = await this.getUserById(id);
    const temporaryPassword = this.generateTemporaryPassword();
    const saltRounds = await this.runtimeConfig.getBcryptSaltRounds();
    const passwordHash = await bcrypt.hash(temporaryPassword, saltRounds);

    await this.prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: true,
      },
    });

    await this.prisma.userSession.updateMany({
      where: { userId: id, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date(), revokedBy: actorId },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: id, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    await this.mailService.sendTemporaryPassword(
      user.email,
      temporaryPassword,
      user.firstName ?? undefined,
    );

    await this.prisma.auditLog.create({
      data: {
        tenantId: 'default',
        actorId,
        action: 'USER_PASSWORD_RESET_BY_ADMIN',
        entityType: 'User',
        entityId: id,
      },
    });

    return this.getUserById(id);
  }

  async deleteUser(id: string, actorId: string) {
    if (id === actorId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.getUserById(id);

    const user = await this.prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: safeUserSelect,
    });

    await this.prisma.userSession.updateMany({
      where: { userId: id, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date(), revokedBy: actorId },
    });

    await this.prisma.refreshToken.updateMany({
      where: { userId: id, isRevoked: false },
      data: { isRevoked: true, revokedAt: new Date() },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId: 'default',
        actorId,
        action: 'USER_DELETE',
        entityType: 'User',
        entityId: id,
      },
    });

    return user;
  }
}
