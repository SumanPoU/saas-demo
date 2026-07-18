import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, PaginationService } from '../common/pagination';

/** Authenticated user context for tenant-scoped audit queries. */
export interface AuditRequestUser {
  tenantId: string;
  isSuperAdmin: boolean;
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
  ) {}

  async getAuditLogs(query: PaginationQueryDto, reqUser: AuditRequestUser) {
    const search = query.search?.trim();
    const searchFilter: Prisma.AuditLogWhereInput | undefined = search
      ? {
          OR: [
            { action: { contains: search, mode: 'insensitive' } },
            { entityType: { contains: search, mode: 'insensitive' } },
            { entityId: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;

    // Super-admin may read all tenants; everyone else is strictly tenant-scoped.
    // Missing tenantId on a non–super-admin must not widen access.
    const tenantFilter: Prisma.AuditLogWhereInput = reqUser.isSuperAdmin
      ? {}
      : { tenantId: reqUser.tenantId };

    const where: Prisma.AuditLogWhereInput = {
      ...tenantFilter,
      ...(searchFilter ?? {}),
    };

    return this.pagination.paginate(this.prisma.auditLog, query, {
      where,
      select: {
        id: true,
        tenantId: true,
        action: true,
        entityType: true,
        entityId: true,
        payload: true,
        ipAddress: true,
        userAgent: true,
        createdAt: true,
        actor: {
          select: {
            id: true,
            username: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
