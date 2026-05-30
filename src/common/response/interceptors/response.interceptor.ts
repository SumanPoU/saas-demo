import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FastifyReply, FastifyRequest } from 'fastify';
import {
  ApiResponse,
  ApiPaginatedResponse,
} from '../interfaces/response.interface';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T> | ApiPaginatedResponse<T>
> {
  constructor(private reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T> | ApiPaginatedResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    // Support for changing response message via a custom decorator could be added here
    const message =
      this.reflector.get<string>('response_message', context.getHandler()) ||
      'Operation successful';

    return next.handle().pipe(
      map((data) => {
        // Handle undefined or null explicitly if needed
        if (data === undefined) {
          data = null;
        }

        // Check if the data is already a paginated result from PaginationService
        if (
          data &&
          typeof data === 'object' &&
          'data' in data &&
          'meta' in data
        ) {
          return {
            success: true,
            statusCode: response.statusCode,
            message: message, // Can be dynamic based on context/metadata if needed
            data: data.data,
            meta: data.meta,
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
          } as ApiPaginatedResponse<T>;
        }

        // Handle standard response
        return {
          success: true,
          statusCode: response.statusCode,
          message: message,
          data,
          timestamp: new Date().toISOString(),
          path: request.url,
          method: request.method,
        } as ApiResponse<T>;
      }),
    );
  }
}
