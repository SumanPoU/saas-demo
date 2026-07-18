import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { toResponseDto, toResponseDtoList } from '../common/serialization';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { RestoreTenantDto } from './dto/restore-tenant.dto';
import { TenantResponseDto } from './dto/tenant-response.dto';
import { TenantsRepository } from './tenants.repository';
import * as crypto from 'crypto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly tenantsRepository: TenantsRepository,
    private readonly mailService: MailService,
  ) {}

  private generateSlug(name: string): string {
    return (
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '') +
      '-' +
      Math.random().toString(36).substring(2, 6)
    );
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private toTenantResponse(tenant: unknown): TenantResponseDto {
    return toResponseDto(TenantResponseDto, tenant);
  }

  async create(userId: string, dto: CreateTenantDto) {
    const slug = dto.slug || this.generateSlug(dto.name);

    const existing = await this.tenantsRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictException('Workspace slug already taken');
    }

    const schemaName = `tenant_${slug.replace(/-/g, '_')}`;

    const tenant = await this.tenantsRepository.createWithOwner(
      {
        name: dto.name,
        slug,
        schemaName,
        settings: dto.settings || {},
      },
      userId,
    );

    return this.toTenantResponse(tenant);
  }

  async findAll(userId: string, isSuperAdmin: boolean) {
    const tenants = isSuperAdmin
      ? await this.tenantsRepository.findAllActive()
      : await this.tenantsRepository.findAllForUser(userId);

    return toResponseDtoList(TenantResponseDto, tenants);
  }

  async findOne(id: string) {
    const tenant = await this.tenantsRepository.findActiveById(id);
    if (!tenant) throw new NotFoundException('Workspace not found');
    return this.toTenantResponse(tenant);
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);

    if (dto.slug) {
      const existing = await this.tenantsRepository.findBySlugExcludingId(
        dto.slug,
        id,
      );
      if (existing) throw new ConflictException('Workspace slug already taken');
    }

    const tenant = await this.tenantsRepository.update(id, dto);
    return this.toTenantResponse(tenant);
  }

  /**
   * Soft-delete a workspace and email the owner a restoration token.
   */
  async remove(id: string, requesterUserId: string) {
    const tenant = await this.tenantsRepository.findActiveById(id);
    if (!tenant) throw new NotFoundException('Workspace not found');

    const ownerMembership =
      await this.tenantsRepository.findOwnerMembership(id);

    const rawToken = crypto.randomBytes(32).toString('hex');
    const restorationToken = this.hashToken(rawToken);

    await this.tenantsRepository.update(id, {
      deletedAt: new Date(),
      deletionRequestedAt: new Date(),
      isActive: false,
      restorationToken,
    });

    const recipientEmail =
      ownerMembership?.user.email ??
      (await this.tenantsRepository.findUserEmail(requesterUserId))?.email;

    if (recipientEmail) {
      await this.mailService.sendTenantRestorationEmail(
        recipientEmail,
        tenant.name,
        rawToken,
      );
    }

    return {
      message:
        'Workspace deleted successfully. A restoration token has been emailed to the owner.',
    };
  }

  /**
   * Restore a soft-deleted workspace using the emailed restoration token.
   */
  async restore(dto: RestoreTenantDto) {
    const tokenHash = this.hashToken(dto.token);

    const tenant =
      await this.tenantsRepository.findByRestorationTokenHash(tokenHash);

    if (!tenant) {
      throw new NotFoundException('Invalid or expired restoration token');
    }

    if (
      tenant.deletionRequestedAt &&
      tenant.deletionRequestedAt.getTime() <
        Date.now() - 30 * 24 * 60 * 60 * 1000
    ) {
      throw new BadRequestException(
        'Restoration window has expired. Contact support.',
      );
    }

    const restored = await this.tenantsRepository.update(tenant.id, {
      deletedAt: null,
      deletionRequestedAt: null,
      restorationToken: null,
      isActive: true,
    });

    return this.toTenantResponse(restored);
  }
}
