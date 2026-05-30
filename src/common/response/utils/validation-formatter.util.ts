import { ValidationError } from '@nestjs/common';
import { ValidationErrorItem } from '../interfaces/response.interface';

export function formatValidationErrors(
  errors: ValidationError[],
): ValidationErrorItem[] {
  const formattedErrors: ValidationErrorItem[] = [];

  const extractErrors = (errs: ValidationError[], parentProperty?: string) => {
    errs.forEach((err) => {
      const propertyPath = parentProperty
        ? `${parentProperty}.${err.property}`
        : err.property;

      if (err.constraints) {
        Object.values(err.constraints).forEach((message) => {
          formattedErrors.push({
            field: propertyPath,
            message: message,
          });
        });
      }

      if (err.children && err.children.length > 0) {
        extractErrors(err.children, propertyPath);
      }
    });
  };

  extractErrors(errors);
  return formattedErrors;
}
