import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import {
  ApiErrorResponse,
  ValidationErrorItem,
} from '../interfaces/response.interface';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';
    let errors: ValidationErrorItem[] | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        error =
          (exceptionResponse as any).error || HttpStatus[status] || 'Error';
        // Handle validation errors specifically formatted by our custom ValidationPipe
        if (
          'errors' in exceptionResponse &&
          Array.isArray((exceptionResponse as any).errors)
        ) {
          message = (exceptionResponse as any).message || 'Validation Failed';
          errors = (exceptionResponse as any).errors;
        } else {
          message = (exceptionResponse as any).message || exception.message;
        }
      } else {
        message = exception.message;
        error = HttpStatus[status] || 'Error';
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      // Prisma Error Handling
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          error = 'Conflict';
          message = 'Unique constraint failed';
          errors = [
            {
              field: exception.meta?.target as string,
              message: 'Value already exists',
            },
          ];
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          error = 'Not Found';
          message = 'Record not found';
          break;
        default:
          status = HttpStatus.BAD_REQUEST;
          error = 'Bad Request';
          message = 'Database operation failed';
          this.logger.error(
            `Prisma Error: ${exception.message}`,
            exception.stack,
          );
          break;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'Bad Request';
      message = 'Database validation error';
      this.logger.error(
        `Prisma Validation Error: ${exception.message}`,
        exception.stack,
      );
    } else {
      // Unhandled Exceptions
      error = 'Internal Server Error';
      this.logger.error(
        `Unhandled Exception: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    }

    const errorResponse: ApiErrorResponse = {
      success: false,
      statusCode: status,
      message,
      error,
      ...(errors && { errors }),
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
    };

    response.status(status).send(errorResponse);
  }
}
