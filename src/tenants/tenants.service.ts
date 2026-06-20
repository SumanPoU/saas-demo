import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  constructor(private prisma: PrismaService) {}

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

  async create(userId: string, dto: CreateTenantDto) {
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check if slug exists
    const existing = await this.prisma.tenant.findUnique({ where: { slug } });
    if (existing) {
      throw new ConflictException('Workspace slug already taken');
    }

    const schemaName = `tenant_${slug.replace(/-/g, '_')}`;

    return this.prisma.$transaction(async (tx) => {
      // Create Tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.name,
          slug,
          schemaName,
          settings: dto.settings || {},
        },
      });

      // Assign creator as owner
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

    // Return only tenants the user is a member of
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
    await this.findOne(id); // Ensures existence

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

  async remove(id: string) {
    await this.findOne(id); // Ensures existence

    return this.prisma.tenant.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletionRequestedAt: new Date(),
        isActive: false,
      },
    });
  }
}
