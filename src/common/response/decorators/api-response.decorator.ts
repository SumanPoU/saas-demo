import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

/**
 * Decorator to generate generic ApiResponse schema in Swagger
 */
export const ApiStandardResponse = <DataDto extends Type<unknown>>(
  dataDto: DataDto,
) => {
  return applyDecorators(
    ApiExtraModels(dataDto),
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              success: { type: 'boolean', example: true },
              statusCode: { type: 'number', example: 200 },
              message: { type: 'string', example: 'Operation successful' },
              data: {
                $ref: getSchemaPath(dataDto),
              },
              timestamp: { type: 'string', format: 'date-time' },
              path: { type: 'string' },
              method: { type: 'string', example: 'GET' },
            },
          },
        ],
      },
    }),
  );
};

/**
 * Decorator to generate generic ApiPaginatedResponse schema in Swagger
 */
export const ApiPaginatedStandardResponse = <DataDto extends Type<unknown>>(
  dataDto: DataDto,
) => {
  return applyDecorators(
    ApiExtraModels(dataDto),
    ApiOkResponse({
      schema: {
        allOf: [
          {
            properties: {
              success: { type: 'boolean', example: true },
              statusCode: { type: 'number', example: 200 },
              message: { type: 'string', example: 'Operation successful' },
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(dataDto) },
              },
              meta: {
                type: 'object',
                properties: {
                  total: { type: 'number', example: 100 },
                  page: { type: 'number', example: 1 },
                  limit: { type: 'number', example: 10 },
                  totalPages: { type: 'number', example: 10 },
                  hasNextPage: { type: 'boolean', example: true },
                  hasPrevPage: { type: 'boolean', example: false },
                },
              },
              timestamp: { type: 'string', format: 'date-time' },
              path: { type: 'string' },
              method: { type: 'string', example: 'GET' },
            },
          },
        ],
      },
    }),
  );
};
