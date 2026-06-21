import { CallHandler, ExecutionContext, Injectable, NestInterceptor, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { LimitsService } from './limits.service';

@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
  constructor(private readonly limitsService: LimitsService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.params?.tenantId || request.user?.tenantId;
    
    if (tenantId) {
      // Simplified: use route path as endpoint identifier
      const endpoint = request.route?.path || request.url.split('?')[0];
      
      const { exceeded } = await this.limitsService.recordApiUsage(tenantId, endpoint);
      
      if (exceeded) {
        throw new HttpException('API usage limit exceeded for this tenant', HttpStatus.TOO_MANY_REQUESTS);
      }
    }

    return next.handle();
  }
}
