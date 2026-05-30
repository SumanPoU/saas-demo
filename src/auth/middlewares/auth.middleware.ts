import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: any, res: any, next: () => void) {
    const authorization = req.headers?.authorization;
    if (!authorization) {
      return next();
    }

    const [type, token] = authorization.split(' ') ?? [];
    if (type !== 'Bearer' || !token) {
      return next();
    }

    try {
      // 1. Verify Access Token signature and expiration
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      if (payload.type === 'mfa_pending') {
        this.logger.warn(
          `Blocked mfa_pending token attempt for sub=${payload.sub}`,
        );
        return next();
      }

      // 2. Validate user and session existence and status
      const session = await this.prisma.userSession.findUnique({
        where: { id: payload.sessionId },
      });

      if (!session || session.isRevoked || session.expiresAt < new Date()) {
        return next();
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          roles: {
            include: {
              rolePermissions: {
                include: { permission: true },
              },
            },
          },
        },
      });

      if (!user || !user.isActive) {
        return next();
      }

      if (
        user.passwordChangedAt &&
        payload.iat * 1000 < user.passwordChangedAt.getTime()
      ) {
        this.logger.debug(
          `Token predates password change for userId=${user.id}`,
        );
        return next();
      }

      // 3. Extract roles and flat permissions
      const roles = user.roles.map((r) => r.name);
      const permissions = Array.from(
        new Set(
          user.roles.flatMap((r) =>
            r.rolePermissions.map(
              (rolePermission) => rolePermission.permission.name,
            ),
          ),
        ),
      );

      // 4. Attach structured user session metadata to the request
      const requestUser = {
        id: user.id,
        username: user.username,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
        mustChangePassword: user.mustChangePassword,
        roles,
        permissions,
        sessionId: session.id,
        tenantId: session.tenantId,
      };

      req.user = requestUser;

      // Fastify adapter sets req.raw for raw node request, support both environments
      if (req.raw) {
        req.raw.user = requestUser;
      }
    } catch (error) {
      // We do not throw exceptions in middleware to support public routes gracefully
      this.logger.debug(
        `Auth token validation failed: ${(error as Error).message}`,
      );
    }

    next();
  }
}
