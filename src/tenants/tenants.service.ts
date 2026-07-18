import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { RestoreTenantDto } from './dto/restore-tenant.dto';
import * as crypto from 'crypto';

@Injectable()
export class TenantsService {
  constructor(
    private readonly prisma: PrismaService,
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

  async create(userId: string, dto: CreateTenantDto) {
    const slug = dto.slug || this.generateSlug(dto.name);

    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Workspace slug already taken');
    }

    const schemaName = `tenant_${slug.replace(/-/g, '_')}`;

    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug,
          schemaName,
          settings: dto.settings || {},
        },
      });

      await tx.tenantMembership.create({
        data: {
          tenantId: tenant.id,
          userId,
          isOwner: true,
        },
      });

      return tenant;
    });
  }

  async findAll(userId: string, isSuperAdmin: boolean) {
    if (isSuperAdmin) {
      return this.prisma.tenant.findMany({
        where: { deletedAt: null },
      });
    }

    return this.prisma.tenant.findMany({
      where: {
        deletedAt: null,
        memberships: {
          some: { userId },
        },
      },
      include: {
        memberships: {
          where: { userId },
          select: { isOwner: true },
        },
      },
    });
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id, deletedAt: null },
    });
    if (!tenant) throw new NotFoundException('Workspace not found');
    return tenant;
  }

  async update(id: string, dto: UpdateTenantDto) {
    await this.findOne(id);

    if (dto.slug) {
      const existing = await this.prisma.tenant.findFirst({
        where: { slug: dto.slug, id: { not: id } },
      });
      if (existing) throw new ConflictException('Workspace slug already taken');
    }

    return this.prisma.tenant.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Soft-delete a workspace and email the owner a restoration token.
   */
  async remove(id: string, requesterUserId: string) {
    const tenant = await this.findOne(id);

    const ownerMembership = await this.prisma.tenantMembership.findFirst({
      where: { tenantId: id, isOwner: true },
      include: { user: { select: { id: true, email: true } } },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const restorationToken = this.hashToken(rawToken);

    await this.prisma.tenant.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletionRequestedAt: new Date(),
        isActive: false,
        restorationToken,
      },
    });

    const recipientEmail =
      ownerMembership?.user.email ??
      (
        await this.prisma.user.findUnique({
          where: { id: requesterUserId },
          select: { email: true },
        })
      )?.email;

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

    const tenant = await this.prisma.tenant.findFirst({
      where: {
        restorationToken: tokenHash,
        deletedAt: { not: null },
      },
    });

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

    return this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        deletedAt: null,
        deletionRequestedAt: null,
        restorationToken: null,
        isActive: true,
      },
    });
  }
}
