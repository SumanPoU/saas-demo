import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 1. Bypass check if route is marked as Public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    // Read pre-populated user from AuthMiddleware (supporting both Express and Fastify raw request objects)
    const user = request.user || request.raw?.user;

    if (!user) {
      throw new UnauthorizedException(
        'Authentication token is missing or invalid',
      );
    }

    if (!user.sessionId) {
      throw new UnauthorizedException(
        'Session context is missing. Please log in again.',
      );
    }

    if (user.mustChangePassword) {
      const path = request.url?.split('?')[0] ?? '';
      const allowedWhileChangingPassword = [
        '/auth/profile',
        '/auth/change-password',
        '/auth/logout',
        '/v1/auth/profile',
        '/v1/auth/change-password',
        '/v1/auth/logout',
      ].some((allowedPath) => path.endsWith(allowedPath));

      if (!allowedWhileChangingPassword) {
        throw new ForbiddenException(
          'Password change is required before accessing this resource.',
        );
      }
    }

    // Role enforcement
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles?.length && !user.isSuperAdmin) {
      const hasRole = requiredRoles.some((r) => user.roles?.includes(r));
      if (!hasRole) {
        throw new ForbiddenException(
          'You do not have the required role to access this resource.',
        );
      }
    }

    // Permission enforcement (AND logic — user must hold ALL listed permissions)
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredPermissions?.length && !user.isSuperAdmin) {
      const hasAll = requiredPermissions.every((p) =>
        user.permissions?.includes(p),
      );
      if (!hasAll) {
        throw new ForbiddenException(
          'You do not have sufficient permissions to access this resource.',
        );
      }
    }

    return true;
  }
}
