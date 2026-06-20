import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class TenantMemberGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;
    
    // Super admins can access any tenant
    if (user?.isSuperAdmin) {
      return true;
    }

    const requestedTenantId = request.params.tenantId || request.params.id;

    if (!user || !user.tenantId || user.tenantId !== requestedTenantId) {
      throw new ForbiddenException('You do not have access to this workspace');
    }

    return true;
  }
}
