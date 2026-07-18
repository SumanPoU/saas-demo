import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { LimitsService } from './limits.service';

interface TenantScopedRequest {
  params?: { tenantId?: string };
  user?: { tenantId?: string };
  route?: { path?: string };
  url?: string;
}

@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
  constructor(private readonly limitsService: LimitsService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<TenantScopedRequest>();
    const tenantId = request.params?.tenantId || request.user?.tenantId;

    if (tenantId) {
      const endpoint =
        request.route?.path || request.url?.split('?')[0] || 'unknown';

      const { exceeded } = await this.limitsService.recordApiUsage(
        tenantId,
        endpoint,
      );

      if (exceeded) {
        throw new HttpException(
          'API usage limit exceeded for this tenant',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return next.handle();
  }
}
