import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto, PaginationService } from '../common/pagination';

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pagination: PaginationService,
  ) {}

  async getAuditLogs(query: PaginationQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.AuditLogWhereInput = search
      ? {
          OR: [
            { action: { contains: search, mode: 'insensitive' } },
            { entityType: { contains: search, mode: 'insensitive' } },
            { entityId: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {};

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
