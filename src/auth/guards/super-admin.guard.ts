import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../interfaces/request-user.interface';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (!user || !user.isSuperAdmin) {
      throw new ForbiddenException('Super admin privileges required');
    }

    return true;
  }
}
