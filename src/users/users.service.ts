import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PaginationService, PaginationQueryDto } from '../common/pagination';
import { toResponseDto, toResponseDtoList } from '../common/serialization';
import { MailService } from '../mail/mail.service';
import { RuntimeConfigService } from '../config/runtime-config.service';
import { MediaService } from '../media/media.service';
import { CreateUserDto, UpdateUserDto, UpdateProfileDto } from './dto';
import { UserResponseDto } from './dto/user-response.dto';
import { safeUserSelect, UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly pagination: PaginationService,
    private readonly mailService: MailService,
    private readonly runtimeConfig: RuntimeConfigService,
    private readonly mediaService: MediaService,
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

  private toUserResponse(user: unknown): UserResponseDto {
    return toResponseDto(UserResponseDto, user);
  }

  async createUser(dto: CreateUserDto, actorId: string) {
    const email = dto.email.toLowerCase();
    const username = this.deriveUsername(email, dto.username);

    const existing = await this.usersRepository.findExistingByEmailOrUsername(
      email,
      username,
    );

    if (existing) {
      throw new ConflictException('User email or username already exists');
    }

    const roles = dto.roleIds?.length
      ? await this.usersRepository.findRolesByIds(dto.roleIds)
      : [];

    if (dto.roleIds?.length && roles.length !== dto.roleIds.length) {
      throw new BadRequestException('One or more role IDs do not exist');
    }

    const temporaryPassword = this.generateTemporaryPassword();
    const saltRounds = await this.runtimeConfig.getBcryptSaltRounds();
    const passwordHash = await bcrypt.hash(temporaryPassword, saltRounds);

    const defaultRole = dto.roleIds?.length
      ? null
      : await this.usersRepository.findDefaultRole();

    const user = await this.usersRepository.createUser({
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
    });

    await this.mailService.sendTemporaryPassword(
      user.email,
      temporaryPassword,
      user.firstName ?? undefined,
    );

    await this.usersRepository.createAuditLog({
      actorId,
      action: 'USER_CREATE',
      entityType: 'User',
      entityId: user.id,
    });

    return this.toUserResponse(user);
  }

  async getUsers(query: PaginationQueryDto, requestUser: any) {
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

    if (!requestUser.isSuperAdmin && requestUser.tenantId) {
      where.tenantMemberships = {
        some: { tenantId: requestUser.tenantId },
      };
    }

    const result = await this.pagination.paginate(
      this.usersRepository.client.user,
      query,
      {
        where,
        select: safeUserSelect,
        orderBy: { createdAt: 'desc' },
      },
    );

    return {
      ...result,
      data: toResponseDtoList(UserResponseDto, result.data),
    };
  }

  async getUserById(id: string, requestUser: any) {
    const where: Prisma.UserWhereInput = { id };

    if (!requestUser.isSuperAdmin && requestUser.tenantId) {
      where.tenantMemberships = {
        some: { tenantId: requestUser.tenantId },
      };
    }

    const user = await this.usersRepository.findFirst({ where });

    if (!user) {
      throw new NotFoundException(
        `User with ID "${id}" not found in your workspace`,
      );
    }

    return this.toUserResponse(user);
  }

  async updateUser(id: string, dto: UpdateUserDto, requestUser: any) {
    await this.getUserById(id, requestUser);

    const user = await this.usersRepository.updateUser(id, dto);
    return this.toUserResponse(user);
  }

  async updateProfile(id: string, dto: UpdateProfileDto, file?: any) {
    let avatarUrl: string | undefined = undefined;

    if (file) {
      const mediaFile = await this.mediaService.uploadFile({
        buffer: file.buffer,
        originalName: file.originalname || file.filename,
        mimeType: file.mimetype,
        size: file.size || file.buffer.length,
        tenantId: undefined,
        purpose: 'AVATAR',
        uploadedById: id,
      });
      avatarUrl = mediaFile.bucketName + '/' + mediaFile.storagePath;
    }

    const dataToUpdate: Prisma.UserUpdateInput = {};
    if (dto.firstName !== undefined) dataToUpdate.firstName = dto.firstName;
    if (dto.lastName !== undefined) dataToUpdate.lastName = dto.lastName;
    if (avatarUrl) dataToUpdate.avatarUrl = avatarUrl;

    const user = await this.usersRepository.updateUser(id, dataToUpdate);
    return this.toUserResponse(user);
  }

  async resetUserPassword(id: string, requestUser: any) {
    const user = await this.getUserById(id, requestUser);
    const temporaryPassword = this.generateTemporaryPassword();
    const saltRounds = await this.runtimeConfig.getBcryptSaltRounds();
    const actorId = requestUser.id || requestUser.userId;
    const passwordHash = await bcrypt.hash(temporaryPassword, saltRounds);

    await this.usersRepository.updatePassword(id, passwordHash);
    await this.usersRepository.revokeSessions(id, actorId);
    await this.usersRepository.revokeRefreshTokens(id);

    await this.mailService.sendTemporaryPassword(
      user.email,
      temporaryPassword,
      user.firstName ?? undefined,
    );

    await this.usersRepository.createAuditLog({
      actorId,
      action: 'USER_PASSWORD_RESET_BY_ADMIN',
      entityType: 'User',
      entityId: id,
    });

    return this.getUserById(id, requestUser);
  }

  async deleteUser(id: string, requestUser: any) {
    if (id === requestUser.id || id === requestUser.userId) {
      throw new BadRequestException('You cannot delete your own account');
    }

    await this.getUserById(id, requestUser);

    const actorId = requestUser.id || requestUser.userId;

    const user = await this.usersRepository.updateUser(id, { isActive: false });

    await this.usersRepository.revokeSessions(id, actorId);
    await this.usersRepository.revokeRefreshTokens(id);

    await this.usersRepository.createAuditLog({
      actorId,
      action: 'USER_DELETE',
      entityType: 'User',
      entityId: id,
    });

    return this.toUserResponse(user);
  }
}
