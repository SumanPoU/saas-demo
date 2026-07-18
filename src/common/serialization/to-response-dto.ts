import {
  ClassConstructor,
  instanceToPlain,
  plainToInstance,
} from 'class-transformer';

/**
 * Map a plain Prisma (or other) object onto a response DTO, then strip
 * `@Exclude()` fields so sensitive data never leaves the service layer.
 */
export function toResponseDto<T, V>(cls: ClassConstructor<T>, plain: V): T {
  const instance = plainToInstance(cls, plain, {
    enableImplicitConversion: true,
  });
  return instanceToPlain(instance) as T;
}

/**
 * Map a list of plain objects onto sanitized response DTO payloads.
 */
export function toResponseDtoList<T, V>(
  cls: ClassConstructor<T>,
  plains: V[],
): T[] {
  return plains.map((plain) => toResponseDto(cls, plain));
}
