import { PaginationMeta } from '../../pagination';

export interface ValidationErrorItem {
  field?: string;
  message: string;
  code?: string;
}

export interface ApiResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
  method: string;
}

export interface ApiPaginatedResponse<T> {
  success: true;
  statusCode: number;
  message: string;
  data: T[];
  meta: PaginationMeta;
  timestamp: string;
  path: string;
  method: string;
}

export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  message: string;
  error: string;
  errors?: ValidationErrorItem[];
  timestamp: string;
  path: string;
  method: string;
}
