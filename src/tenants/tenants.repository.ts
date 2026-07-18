import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TenantsRepository {
  constructor(private readonly prisma: PrismaService) {}

  get client() {
    return this.prisma;
  }

  findBySlug(slug: string) {
    return this.prisma.tenant.findUnique({ where: { slug } });
  }

  findBySlugExcludingId(slug: string, id: string) {
    return this.prisma.tenant.findFirst({
      where: { slug, id: { not: id } },
    });
  }

  findActiveById(id: string) {
    return this.prisma.tenant.findFirst({
      where: { id, deletedAt: null },
    });
  }

  findAllActive() {
    return this.prisma.tenant.findMany({
      where: { deletedAt: null },
    });
  }

  findAllForUser(userId: string) {
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

  createWithOwner(tenantData: Prisma.TenantCreateInput, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({ data: tenantData });
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

  update(id: string, data: Prisma.TenantUpdateInput) {
    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  findOwnerMembership(tenantId: string) {
    return this.prisma.tenantMembership.findFirst({
      where: { tenantId, isOwner: true },
      include: { user: { select: { id: true, email: true } } },
    });
  }

  findUserEmail(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
  }

  findByRestorationTokenHash(tokenHash: string) {
    return this.prisma.tenant.findFirst({
      where: {
        restorationToken: tokenHash,
        deletedAt: { not: null },
      },
    });
  }
}
