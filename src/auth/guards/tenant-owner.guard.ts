import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class TenantOwnerGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    // Super admins can access any tenant as an owner
    if (user?.isSuperAdmin) {
      return true;
    }

    const requestedTenantId = request.params.tenantId || request.params.id;

    if (!user || !user.tenantId || user.tenantId !== requestedTenantId) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    const membership = await this.prisma.tenantMembership.findUnique({
      where: {
        tenantId_userId: {
          tenantId: user.tenantId,
          userId: user.userId || (user as any).id, // Support different object shapes
        },
      },
    });

    if (!membership?.isOwner) {
      throw new ForbiddenException('Workspace owner privileges required');
    }

    return true;
  }
}
